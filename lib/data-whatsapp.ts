import "server-only";

import QRCode from "qrcode";
import { query } from "@/lib/db/pool";
import type {
  EstadoConexionWa,
  EstadoTurno,
  FichaPacienteWa,
  ModoWa,
  RolWaMensaje,
  WaConversacion,
  WaEstadoConexion,
  WaMensaje,
} from "@/lib/types";

// Los timestamps que usa el navegador salen como ISO UTC ("…T…Z"): el formato
// crudo de Postgres ("2026-10-13 13:00:00+00") no lo parsea Safari.

/**
 * Capa de datos del módulo WhatsApp (tablas wa_*). El schema lo aplica el
 * servicio `bot` al arrancar (bot/src/db.ts); si el bot nunca corrió sobre esta
 * base, las tablas pueden no existir y estos getters devuelven vacío en vez de
 * romper el panel.
 */

/** "No existe la tabla" (42P01) o "no existe la columna" (42703). */
export function esquemaIncompleto(error: unknown): boolean {
  if (typeof error !== "object" || error === null || !("code" in error)) return false;
  const codigo = (error as { code?: string }).code;
  return codigo === "42P01" || codigo === "42703";
}

interface FilaEstadoConexion {
  estado: EstadoConexionWa;
  qr_string: string | null;
  telefono: string | null;
  actualizado_en: string;
}

export async function obtenerEstadoConexionWa(): Promise<WaEstadoConexion> {
  let fila: FilaEstadoConexion | undefined;
  try {
    const filas = await query<FilaEstadoConexion>(
      "select estado, qr_string, telefono, actualizado_en from wa_estado_conexion where id = 1",
    );
    fila = filas[0];
  } catch (error) {
    if (!esquemaIncompleto(error)) throw error;
  }
  if (!fila) {
    return {
      estado: "desconectado",
      telefono: null,
      qr: null,
      actualizadoEn: new Date().toISOString(),
    };
  }

  // Defensivo: mostrar el QR aunque el estado haya quedado en 'conectando'
  // (race entre el evento `qr` y el `connecting` de Baileys).
  const mostrarQr =
    !!fila.qr_string && (fila.estado === "qr" || fila.estado === "conectando");
  const qr = mostrarQr
    ? await QRCode.toDataURL(fila.qr_string as string, { width: 320, margin: 2 })
    : null;

  return {
    estado: fila.estado,
    telefono: fila.telefono,
    qr,
    actualizadoEn: fila.actualizado_en,
  };
}

export async function botConectado(): Promise<boolean> {
  return (await obtenerEstadoConexionWa()).estado === "conectado";
}

export async function obtenerRecordatoriosAutomaticos(): Promise<boolean> {
  try {
    const filas = await query<{ activo: boolean }>(
      "select recordatorios_automaticos as activo from wa_config where id = 1",
    );
    return filas[0]?.activo ?? false;
  } catch (error) {
    if (esquemaIncompleto(error)) return false;
    throw error;
  }
}

interface FilaConversacionWa {
  id: string;
  telefono: string;
  nombre: string | null;
  modo: ModoWa;
  paciente_id: string | null;
  paciente_nombre: string | null;
  requiere_atencion: boolean;
  ultimo_mensaje: string | null;
  ultimo_mensaje_en: string | null;
}

function mapearConversacionWa(f: FilaConversacionWa): WaConversacion {
  return {
    id: f.id,
    telefono: f.telefono,
    nombre: f.nombre,
    modo: f.modo,
    pacienteId: f.paciente_id,
    pacienteNombre: f.paciente_nombre,
    requiereAtencion: f.requiere_atencion,
    ultimoMensaje: f.ultimo_mensaje,
    ultimoMensajeEn: f.ultimo_mensaje_en,
  };
}

const SELECT_CONVERSACION = `
  select c.id, c.telefono, c.nombre, c.modo, c.paciente_id, p.nombre as paciente_nombre,
         c.requiere_atencion, to_char(c.ultimo_mensaje_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as ultimo_mensaje_en,
         (select m.contenido from wa_mensajes m
          where m.conversacion_id = c.id
          order by m.creado_en desc, m.id desc
          limit 1) as ultimo_mensaje
  from wa_conversaciones c
  left join pacientes p on p.id = c.paciente_id
`;

/** Las que requieren atención primero; después, la más reciente. */
export async function obtenerConversacionesWa(): Promise<WaConversacion[]> {
  try {
    const filas = await query<FilaConversacionWa>(
      `${SELECT_CONVERSACION}
       order by c.requiere_atencion desc, c.ultimo_mensaje_en desc nulls last, c.creado_en desc`,
    );
    return filas.map(mapearConversacionWa);
  } catch (error) {
    if (esquemaIncompleto(error)) return [];
    throw error;
  }
}

export async function contarConversacionesConAtencion(): Promise<number> {
  try {
    const filas = await query<{ total: string }>(
      "select count(*) as total from wa_conversaciones where requiere_atencion",
    );
    return Number(filas[0]?.total ?? 0);
  } catch (error) {
    if (esquemaIncompleto(error)) return 0;
    throw error;
  }
}

interface FilaFicha {
  id: string;
  nombre: string;
  telefono: string;
  email: string | null;
  nota: string | null;
}

interface FilaTurnoFicha {
  id: string;
  fecha: string;
  hora: string;
  estado: EstadoTurno;
  profesional: string | null;
}

async function obtenerFichaPaciente(pacienteId: string): Promise<FichaPacienteWa | null> {
  const [pacientes, turnos] = await Promise.all([
    query<FilaFicha>(
      "select id, nombre, telefono, email, nota from pacientes where id = $1",
      [pacienteId],
    ),
    query<FilaTurnoFicha>(
      `select t.id,
              to_char(t.inicio at time zone c.zona_horaria, 'YYYY-MM-DD') as fecha,
              to_char(t.inicio at time zone c.zona_horaria, 'HH24:MI') as hora,
              t.estado, pr.nombre as profesional
       from turnos t
       cross join (select zona_horaria from consultorio where id = 1) c
       left join profesionales pr on pr.id = t.profesional_id
       where t.paciente_id = $1 and t.inicio >= now() - interval '1 day'
       order by t.inicio
       limit 5`,
      [pacienteId],
    ),
  ]);
  const p = pacientes[0];
  if (!p) return null;
  return { ...p, proximosTurnos: turnos };
}

interface FilaMensajeWa {
  id: string;
  rol: RolWaMensaje;
  contenido: string;
  creado_en: string;
}

/**
 * Conversación + mensajes + ficha del paciente. Es lo que pollea el panel cada
 * 2 s mientras hay un hilo abierto, por eso viene todo en un request.
 */
export async function obtenerConversacionWa(id: string): Promise<{
  conversacion: WaConversacion;
  mensajes: WaMensaje[];
  paciente: FichaPacienteWa | null;
} | null> {
  try {
    const conversaciones = await query<FilaConversacionWa>(
      `${SELECT_CONVERSACION} where c.id = $1`,
      [id],
    );
    const conversacion = conversaciones[0];
    if (!conversacion) return null;

    const [mensajes, paciente] = await Promise.all([
      query<FilaMensajeWa>(
        `select id, rol, contenido, to_char(creado_en at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as creado_en from wa_mensajes
         where conversacion_id = $1
         order by creado_en asc, id asc`,
        [id],
      ),
      conversacion.paciente_id ? obtenerFichaPaciente(conversacion.paciente_id) : null,
    ]);

    return {
      conversacion: mapearConversacionWa(conversacion),
      mensajes: mensajes.map((m) => ({
        id: m.id,
        rol: m.rol,
        contenido: m.contenido,
        creadoEn: m.creado_en,
      })),
      paciente,
    };
  } catch (error) {
    if (esquemaIncompleto(error)) return null;
    throw error;
  }
}
