"use server";

import { revalidatePath } from "next/cache";
import { query, transaccion } from "@/lib/db/pool";
import { getRedis } from "@/lib/db/redis";
import { esAdministrador, usuarioActual } from "@/lib/auth";
import { mensajeDeError, type EstadoFormulario } from "@/lib/acciones/estado";
import type { ModoWa } from "@/lib/types";

const MODOS_VALIDOS: ModoWa[] = ["ia", "humano"];

export async function cambiarModoConversacion(
  id: string,
  modo: ModoWa,
): Promise<EstadoFormulario> {
  await usuarioActual();
  if (!MODOS_VALIDOS.includes(modo)) {
    return { ok: false, error: "Elegí un modo válido." };
  }
  try {
    await query("update wa_conversaciones set modo = $1 where id = $2", [modo, id]);
    revalidatePath("/whatsapp");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error, "No pudimos cambiar el modo.");
  }
}

/**
 * Envía un mensaje como persona: lo guarda en la DB (para verlo al instante en
 * el panel) y lo encola en Redis; el bot lo saca de la cola y lo manda.
 * Responder también apaga el "requiere atención" de la conversación.
 */
export async function enviarMensajeHumano(
  id: string,
  contenido: string,
): Promise<EstadoFormulario> {
  await usuarioActual();
  const texto = contenido.trim();
  if (!texto) return { ok: false, error: "Escribí un mensaje." };

  try {
    const filas = await query<{ telefono: string }>(
      "select telefono from wa_conversaciones where id = $1",
      [id],
    );
    const conversacion = filas[0];
    if (!conversacion) return { ok: false, error: "La conversación ya no existe." };

    await transaccion(async (cliente) => {
      await cliente.query(
        "insert into wa_mensajes (conversacion_id, rol, contenido) values ($1, 'humano', $2)",
        [id, texto],
      );
      await cliente.query(
        `update wa_conversaciones
         set ultimo_mensaje_en = now(), requiere_atencion = false
         where id = $1`,
        [id],
      );
    });

    const redis = await getRedis();
    await redis.lPush(
      "wa:outbox",
      JSON.stringify({ telefono: conversacion.telefono, contenido: texto }),
    );
    revalidatePath("/whatsapp");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error, "No pudimos enviar el mensaje.");
  }
}

export async function marcarConversacionAtendida(id: string): Promise<EstadoFormulario> {
  await usuarioActual();
  try {
    await query("update wa_conversaciones set requiere_atencion = false where id = $1", [id]);
    revalidatePath("/whatsapp");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error, "No pudimos actualizar la conversación.");
  }
}

/**
 * Da de alta como paciente a quien escribe y vincula la conversación. Si ya
 * había un paciente con ese teléfono, vincula ese en vez de duplicar.
 */
export async function crearPacienteDesdeConversacion(
  id: string,
  nombre: string,
): Promise<EstadoFormulario> {
  await usuarioActual();
  const nombreLimpio = nombre.trim();
  if (!nombreLimpio) return { ok: false, error: "Poné el nombre del paciente." };

  try {
    const resultado = await transaccion(async (cliente) => {
      const { rows } = await cliente.query<{ telefono: string }>(
        "select telefono from wa_conversaciones where id = $1 for update",
        [id],
      );
      const telefono = rows[0]?.telefono;
      if (!telefono) return "sin-conversacion" as const;

      const existente = await cliente.query<{ id: string }>(
        `select id from pacientes
         where not archivado
           and right(regexp_replace(telefono, '\\D', '', 'g'), 10) = right($1, 10)
         order by creado_en desc limit 1`,
        [telefono.replace(/\D/g, "")],
      );
      let pacienteId = existente.rows[0]?.id;
      if (!pacienteId) {
        const nuevo = await cliente.query<{ id: string }>(
          "insert into pacientes (nombre, telefono) values ($1, $2) returning id",
          [nombreLimpio, `+${telefono}`],
        );
        pacienteId = nuevo.rows[0].id;
      }
      await cliente.query("update wa_conversaciones set paciente_id = $2 where id = $1", [
        id,
        pacienteId,
      ]);
      return "ok" as const;
    });
    if (resultado === "sin-conversacion") {
      return { ok: false, error: "La conversación ya no existe." };
    }
    revalidatePath("/whatsapp");
    revalidatePath("/pacientes");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error, "No pudimos crear el paciente.");
  }
}

export async function eliminarConversacionWa(id: string): Promise<EstadoFormulario> {
  await usuarioActual();
  try {
    // El on delete cascade borra también sus mensajes.
    await query("delete from wa_conversaciones where id = $1", [id]);
    revalidatePath("/whatsapp");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error, "No pudimos borrar la conversación.");
  }
}

/**
 * Desconexión manual: encola la señal de restart; el bot cierra la sesión de
 * Baileys, borra la carpeta auth/ y genera un QR nuevo.
 */
export async function desconectarWhatsapp(): Promise<EstadoFormulario> {
  if (!(await esAdministrador())) {
    return { ok: false, error: "Solo quien administra el consultorio puede desconectar WhatsApp." };
  }
  try {
    const redis = await getRedis();
    await redis.lPush("wa:control", "restart");
    revalidatePath("/whatsapp");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error, "No pudimos desconectar.");
  }
}

/** Prende o apaga el envío automático de recordatorios por el bot. */
export async function cambiarRecordatoriosAutomaticos(
  activo: boolean,
): Promise<EstadoFormulario> {
  if (!(await esAdministrador())) {
    return { ok: false, error: "Solo quien administra el consultorio puede cambiar esto." };
  }
  try {
    await query(
      `insert into wa_config (id, recordatorios_automaticos) values (1, $1)
       on conflict (id) do update set recordatorios_automaticos = excluded.recordatorios_automaticos`,
      [activo],
    );
    revalidatePath("/configuracion");
    return { ok: true };
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: string }).code === "42P01"
    ) {
      return {
        ok: false,
        error: "Primero levantá el bot de WhatsApp (docker compose up -d --build bot).",
      };
    }
    return mensajeDeError(error, "No pudimos guardar la configuración.");
  }
}
