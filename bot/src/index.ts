import {
  cerrarPool,
  ensureSchema,
  getEstadoConexion,
  getOrCreateConversacion,
  getTurnosParaRecordar,
  insertarMensaje,
  liberarRecordatorio,
  reclamarRecordatorio,
  recordatoriosAutomaticosActivos,
  vincularConversacionAPaciente,
} from "./db.js";
import { mensajeRecordatorio, numeroWhatsapp } from "./mensajes.js";
import { crearRedis } from "./redis.js";
import { enviarTexto, iniciarBaileys, reinicioLimpio } from "./baileys/client.js";

const dormir = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));

interface JobOutbox {
  telefono: string;
  contenido: string;
}

/**
 * Cola de salientes: el panel encola (LPUSH wa:outbox) los mensajes que manda
 * una persona y los recordatorios que se envían "por el bot"; acá se drenan y
 * se envían por Baileys. El panel ya insertó el mensaje en la DB: el bot solo
 * transporta.
 */
async function loopOutbox(): Promise<void> {
  const redis = crearRedis();
  for (;;) {
    try {
      const res = await redis.brpop("wa:outbox", 5);
      if (!res) continue;
      const job = JSON.parse(res[1]) as JobOutbox;
      try {
        await enviarTexto(job.telefono, job.contenido);
        console.log(`[bot] → outbox enviado a ${job.telefono}`);
      } catch (err) {
        // Conexión caída: re-encolar y esperar; se reintenta cuando vuelva.
        console.warn(`[bot] falló el envío a ${job.telefono}, se re-encola:`, err);
        await redis.lpush("wa:outbox", res[1]);
        await dormir(2000);
      }
    } catch (err) {
      console.error("[bot] error en el loop outbox:", err);
      await dormir(2000);
    }
  }
}

const MINUTO = 60_000;

/**
 * Recordatorios automáticos: si están activados en Configuración, cada minuto
 * manda los que entran en la anticipación configurada. Cada turno se reserva
 * en `recordatorios` antes de enviar (unique por turno + horario), así no sale
 * dos veces aunque alguien lo mande a mano desde el panel al mismo tiempo.
 */
async function loopRecordatorios(): Promise<void> {
  for (;;) {
    try {
      const conectado = (await getEstadoConexion())?.estado === "conectado";
      if (conectado && (await recordatoriosAutomaticosActivos())) {
        for (const turno of await getTurnosParaRecordar()) {
          const numero = numeroWhatsapp(turno.telefono);
          if (!numero) {
            console.warn(`[bot] teléfono inválido para recordatorio: ${turno.paciente_nombre}`);
            continue;
          }
          const mensaje = mensajeRecordatorio({
            pacienteNombre: turno.paciente_nombre,
            fecha: turno.fecha,
            hora: turno.hora,
            consultorio: turno.consultorio,
            profesional: turno.profesional,
          });
          const reserva = await reclamarRecordatorio(turno, mensaje);
          if (!reserva) continue;
          try {
            await enviarTexto(numero, mensaje);
          } catch (err) {
            console.warn(`[bot] falló el recordatorio a ${numero}, se reintenta:`, err);
            await liberarRecordatorio(reserva);
            break; // probablemente se cayó la conexión: esperar a la próxima vuelta
          }
          const conversacion = await getOrCreateConversacion(numero, null);
          await vincularConversacionAPaciente(conversacion.id, turno.paciente_id);
          await insertarMensaje(conversacion.id, "sistema", mensaje);
          console.log(`[bot] → recordatorio automático a ${numero}`);
          await dormir(3000); // no disparar ráfagas: WhatsApp las penaliza
        }
      }
    } catch (err) {
      console.error("[bot] error en el loop de recordatorios:", err);
    }
    await dormir(MINUTO);
  }
}

/** Señales de control desde el panel (hoy solo 'restart' = desconectar). */
async function loopControl(): Promise<void> {
  const redis = crearRedis();
  for (;;) {
    try {
      const res = await redis.brpop("wa:control", 5);
      if (!res) continue;
      if (res[1] === "restart") {
        console.log("[bot] señal de restart: cerrando sesión y regenerando QR");
        await reinicioLimpio();
      }
    } catch (err) {
      console.error("[bot] error en el loop de control:", err);
      await dormir(2000);
    }
  }
}

async function main(): Promise<void> {
  console.log("[bot] arrancando…");
  await ensureSchema();
  await iniciarBaileys();
  void loopOutbox();
  void loopControl();
  void loopRecordatorios();
}

for (const senal of ["SIGINT", "SIGTERM"] as const) {
  process.on(senal, () => {
    console.log(`[bot] ${senal}: cerrando`);
    void cerrarPool().finally(() => process.exit(0));
  });
}

main().catch((err) => {
  console.error("[bot] error fatal al arrancar:", err);
  process.exit(1);
});
