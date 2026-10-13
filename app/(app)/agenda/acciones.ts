"use server";

import { revalidatePath } from "next/cache";
import type { PoolClient } from "pg";
import { query, transaccion } from "@/lib/db/pool";
import { usuarioActual } from "@/lib/auth";
import { obtenerHorarios, obtenerTurno } from "@/lib/data";
import { errorDeHorario } from "@/lib/horarios";
import { botConectado } from "@/lib/data-whatsapp";
import { getRedis } from "@/lib/db/redis";
import { numeroWhatsapp } from "@/lib/recordatorios";
import { esFechaValida, esHoraValida } from "@/lib/fechas";
import {
  aTexto,
  mensajeDeError,
  type EstadoFormulario,
} from "@/lib/acciones/estado";
import { SIN_PROFESIONAL, SIN_SERVICIO } from "@/lib/labels";
import type { CanalRecordatorio, EstadoTurno } from "@/lib/types";

const ESTADOS: EstadoTurno[] = ["pendiente", "confirmado", "cancelado", "realizado"];
const CANALES: CanalRecordatorio[] = ["whatsapp_manual", "copiado"];
const ETIQUETA_ESTADO: Record<EstadoTurno, string> = {
  pendiente: "pendiente",
  confirmado: "confirmado",
  cancelado: "cancelado",
  realizado: "realizado",
};

function revalidar() {
  revalidatePath("/agenda");
  revalidatePath("/inicio");
  revalidatePath("/recordatorios");
  revalidatePath("/pacientes");
}

/**
 * `23P01` = la exclusion constraint `turnos_sin_superposicion`: el horario se
 * pisa con otro turno activo del mismo profesional (o de la agenda única).
 */
function errorDeTurno(error: unknown, generico: string): EstadoFormulario {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23P01"
  ) {
    return {
      ok: false,
      error:
        "Ese horario se superpone con otro turno de la misma agenda. Elegí otro horario u otro profesional.",
    };
  }
  return mensajeDeError(error, generico);
}

function leerProfesional(formData: FormData): string | null {
  const valor = aTexto(formData.get("profesional_id"));
  return valor === SIN_PROFESIONAL ? null : valor;
}

function leerServicio(formData: FormData): string | null {
  const valor = aTexto(formData.get("servicio_id"));
  return valor === SIN_SERVICIO ? null : valor;
}

interface Horario {
  fecha: string;
  hora: string;
  duracion: number;
}

function leerHorario(formData: FormData): Horario | { error: string } {
  const fecha = String(formData.get("fecha") ?? "");
  const hora = String(formData.get("hora") ?? "");
  const duracion = Number(formData.get("duracion"));
  if (!esFechaValida(fecha)) return { error: "Elegí una fecha válida." };
  if (!esHoraValida(hora)) return { error: "Elegí una hora válida (HH:MM)." };
  if (!Number.isInteger(duracion) || duracion < 5 || duracion > 480) {
    return { error: "La duración tiene que ser de 5 a 480 minutos." };
  }
  return { fecha, hora, duracion };
}

/**
 * El turno tiene que entrar en el horario de atención del profesional (o en el
 * general). Devuelve el mensaje de error, o `null` si está bien.
 */
async function validarHorarioAtencion(
  horario: Horario,
  profesionalId: string | null,
  servicioId: string | null,
): Promise<string | null> {
  const [franjas, filas] = await Promise.all([
    obtenerHorarios(),
    query<{ profesional: string | null; lugar_id: string | null }>(
      `select (select nombre from profesionales where id = $1) as profesional,
              (select lugar_id from servicios where id = $2) as lugar_id`,
      [profesionalId, servicioId],
    ),
  ]);
  return errorDeHorario({
    franjas,
    profesionalId,
    profesionalNombre: filas[0]?.profesional ?? null,
    lugarId: filas[0]?.lugar_id ?? null,
    ...horario,
  });
}

async function registrarEvento(
  cliente: PoolClient,
  turnoId: string,
  tipo: "creado" | "reprogramado" | "estado" | "recordatorio",
  descripcion: string,
  actor: string,
) {
  await cliente.query(
    `insert into eventos_turno (turno_id, tipo, descripcion, actor) values ($1, $2, $3, $4)`,
    [turnoId, tipo, descripcion, actor],
  );
}

// La fecha y la hora llegan en la zona del consultorio: Postgres arma el
// instante con `(fecha + hora) at time zone zona` (respeta horario de verano).
const INICIO_LOCAL = `(($1::date + $2::time) at time zone (select zona_horaria from consultorio where id = 1))`;

export async function crearTurno(
  _prev: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const actor = await usuarioActual();
  const pacienteId = String(formData.get("paciente_id") ?? "");
  const profesionalId = leerProfesional(formData);
  const servicioId = leerServicio(formData);
  const nota = aTexto(formData.get("nota"));
  const horario = leerHorario(formData);

  if (!pacienteId) return { ok: false, error: "Elegí un paciente." };
  if ("error" in horario) return { ok: false, error: horario.error };
  if (nota && nota.length > 500) {
    return { ok: false, error: "La nota puede tener hasta 500 caracteres." };
  }

  try {
    const fueraDeHorario = await validarHorarioAtencion(horario, profesionalId, servicioId);
    if (fueraDeHorario) return { ok: false, error: fueraDeHorario };

    await transaccion(async (cliente) => {
      const { rows } = await cliente.query<{ id: string }>(
        `insert into turnos (paciente_id, profesional_id, servicio_id, inicio, fin, nota)
         values ($3, $4, $7, ${INICIO_LOCAL}, ${INICIO_LOCAL} + make_interval(mins => $5), $6)
         returning id`,
        [horario.fecha, horario.hora, pacienteId, profesionalId, horario.duracion, nota, servicioId],
      );
      await registrarEvento(
        cliente,
        rows[0].id,
        "creado",
        `Turno agendado para el ${horario.fecha} a las ${horario.hora}`,
        actor.nombre,
      );
    });
    revalidar();
    return { ok: true };
  } catch (error) {
    return errorDeTurno(error, "No pudimos agendar el turno.");
  }
}

/**
 * Reprogramar mueve el turno y lo vuelve a "pendiente": el paciente tiene que
 * confirmar el horario nuevo. El recordatorio del horario viejo deja de valer.
 */
export async function reprogramarTurno(
  _prev: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const actor = await usuarioActual();
  const id = String(formData.get("id") ?? "");
  const profesionalId = leerProfesional(formData);
  const horario = leerHorario(formData);
  if ("error" in horario) return { ok: false, error: horario.error };

  const anterior = await obtenerTurno(id);
  if (!anterior) return { ok: false, error: "El turno ya no existe." };
  if (anterior.estado === "cancelado" || anterior.estado === "realizado") {
    return {
      ok: false,
      error: "Solo se pueden reprogramar turnos pendientes o confirmados.",
    };
  }

  try {
    const fueraDeHorario = await validarHorarioAtencion(
      horario,
      profesionalId,
      anterior.servicioId,
    );
    if (fueraDeHorario) return { ok: false, error: fueraDeHorario };

    await transaccion(async (cliente) => {
      await cliente.query(
        `update turnos
         set inicio = ${INICIO_LOCAL},
             fin = ${INICIO_LOCAL} + make_interval(mins => $4),
             profesional_id = $5,
             estado = 'pendiente',
             actualizado_en = now()
         where id = $3`,
        [horario.fecha, horario.hora, id, horario.duracion, profesionalId],
      );
      await registrarEvento(
        cliente,
        id,
        "reprogramado",
        `Reprogramado del ${anterior.fecha} ${anterior.hora} al ${horario.fecha} ${horario.hora}`,
        actor.nombre,
      );
    });
    revalidar();
    return { ok: true };
  } catch (error) {
    return errorDeTurno(error, "No pudimos reprogramar el turno.");
  }
}

export async function cambiarEstadoTurno(
  id: string,
  estado: EstadoTurno,
): Promise<EstadoFormulario> {
  const actor = await usuarioActual();
  if (!ESTADOS.includes(estado)) {
    return { ok: false, error: "Elegí un estado válido." };
  }

  try {
    const cambiado = await transaccion(async (cliente) => {
      const { rows } = await cliente.query<{ id: string }>(
        `update turnos set estado = $2, actualizado_en = now()
         where id = $1 and estado <> $2
         returning id`,
        [id, estado],
      );
      if (rows.length === 0) return false;
      await registrarEvento(
        cliente,
        id,
        "estado",
        `Marcado como ${ETIQUETA_ESTADO[estado]}`,
        actor.nombre,
      );
      return true;
    });
    if (cambiado) revalidar();
    return { ok: true };
  } catch (error) {
    // Reactivar un cancelado puede chocar con un turno que tomó su lugar.
    return errorDeTurno(error, "No pudimos cambiar el estado del turno.");
  }
}

/**
 * Registra que se envió el recordatorio del horario actual del turno.
 * Idempotente: el unique (turno_id, turno_inicio) + `on conflict do nothing`
 * evita duplicados si se reintenta o se aprieta dos veces. El texto se arma
 * de nuevo en el servidor (no se confía en el que mandó el navegador).
 */
export async function marcarRecordatorioEnviado(
  turnoId: string,
  canal: CanalRecordatorio,
): Promise<EstadoFormulario> {
  const actor = await usuarioActual();
  if (!CANALES.includes(canal)) {
    return { ok: false, error: "Canal inválido." };
  }

  const turno = await obtenerTurno(turnoId);
  if (!turno) return { ok: false, error: "El turno ya no existe." };
  if (turno.estado === "cancelado" || turno.estado === "realizado") {
    return { ok: false, error: "Ese turno ya no está activo." };
  }

  try {
    await transaccion(async (cliente) => {
      const { rows } = await cliente.query<{ id: string }>(
        `insert into recordatorios (turno_id, turno_inicio, canal, mensaje, enviado_por)
         select id, inicio, $2, $3, $4 from turnos where id = $1
         on conflict (turno_id, turno_inicio) do nothing
         returning id`,
        [turnoId, canal, turno.mensajeRecordatorio, actor.id],
      );
      if (rows.length > 0) {
        await registrarEvento(
          cliente,
          turnoId,
          "recordatorio",
          "Recordatorio enviado",
          actor.nombre,
        );
      }
    });
    revalidar();
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error, "No pudimos registrar el recordatorio.");
  }
}

/**
 * Manda el recordatorio por el bot de WhatsApp (cola wa:outbox). Igual que el
 * flujo manual, se registra una sola vez por turno y horario: si ya estaba
 * enviado no se vuelve a mandar. El mensaje queda en la conversación con rol
 * 'sistema', así el bot reconoce un "sí" del paciente como confirmación.
 */
export async function enviarRecordatorioPorBot(
  turnoId: string,
): Promise<EstadoFormulario> {
  const actor = await usuarioActual();

  const turno = await obtenerTurno(turnoId);
  if (!turno) return { ok: false, error: "El turno ya no existe." };
  if (turno.estado === "cancelado" || turno.estado === "realizado" || turno.pasado) {
    return { ok: false, error: "Ese turno ya no está activo." };
  }
  const numero = numeroWhatsapp(turno.pacienteTelefono);
  if (!numero) {
    return {
      ok: false,
      error: "El teléfono del paciente no tiene formato completo (ej.: +54 9 351 555 0101).",
    };
  }
  if (!(await botConectado())) {
    return { ok: false, error: "El bot de WhatsApp no está conectado." };
  }

  try {
    const enviado = await transaccion(async (cliente) => {
      const { rows } = await cliente.query<{ id: string }>(
        `insert into recordatorios (turno_id, turno_inicio, canal, mensaje, enviado_por)
         select id, inicio, 'whatsapp_bot', $2, $3 from turnos where id = $1
         on conflict (turno_id, turno_inicio) do nothing
         returning id`,
        [turnoId, turno.mensajeRecordatorio, actor.id],
      );
      if (rows.length === 0) return false;

      const conversacion = await cliente.query<{ id: string }>(
        `insert into wa_conversaciones (telefono, nombre, paciente_id) values ($1, $2, $3)
         on conflict (telefono) do update
           set paciente_id = coalesce(wa_conversaciones.paciente_id, excluded.paciente_id)
         returning id`,
        [numero, turno.pacienteNombre, turno.pacienteId],
      );
      await cliente.query(
        "insert into wa_mensajes (conversacion_id, rol, contenido) values ($1, 'sistema', $2)",
        [conversacion.rows[0].id, turno.mensajeRecordatorio],
      );
      await cliente.query(
        "update wa_conversaciones set ultimo_mensaje_en = now() where id = $1",
        [conversacion.rows[0].id],
      );
      await registrarEvento(
        cliente,
        turnoId,
        "recordatorio",
        "Recordatorio enviado por el bot de WhatsApp",
        actor.nombre,
      );
      return true;
    });

    if (enviado) {
      const redis = await getRedis();
      await redis.lPush(
        "wa:outbox",
        JSON.stringify({ telefono: numero, contenido: turno.mensajeRecordatorio }),
      );
    }
    revalidar();
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error, "No pudimos enviar el recordatorio.");
  }
}
