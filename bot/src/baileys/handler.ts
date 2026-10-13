import {
  isJidBroadcast,
  isJidGroup,
  isJidNewsletter,
  isLidUser,
  isPnUser,
  normalizeMessageContent,
  type WAMessage,
  type WAMessageKey,
  type WASocket,
} from "@whiskeysockets/baileys";
import {
  confirmarTurno,
  getConsultorio,
  getContextoPaciente,
  getHistorialReciente,
  getModo,
  getOrCreateConversacion,
  getUltimoMensajeNuestro,
  insertarMensaje,
  marcarAtencion,
  registrarEventoTurno,
  vincularPaciente,
  type ContextoPaciente,
  type RolWaMensaje,
} from "../db.js";
import { generarRespuesta, hayLlm } from "../openai.js";
import { MARCA_DERIVAR } from "../system-prompt.js";
import { esConfirmacion, esPedidoDeCambio, fechaLarga, nombrePila } from "../mensajes.js";

/** Un "sí" cuenta como respuesta al recordatorio si llega dentro de este plazo. */
const HORAS_RESPUESTA_RECORDATORIO = 48;

export function registrarHandlers(sock: WASocket): void {
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    // Solo mensajes nuevos en vivo; 'append'/'replace' son historial.
    if (type !== "notify") return;
    for (const msg of messages) {
      try {
        await procesarMensaje(sock, msg);
      } catch (err) {
        console.error("[bot] error procesando mensaje:", err);
      }
    }
  });
}

/**
 * Desenvuelve los wrappers de Baileys (mensajes efímeros, ver una vez) y saca
 * el texto plano.
 */
function extraerTexto(msg: WAMessage): string | null {
  const contenido = normalizeMessageContent(msg.message);
  return contenido?.conversation ?? contenido?.extendedTextMessage?.text ?? null;
}

/**
 * Número de teléfono del chat. Baileys 7 direcciona los chats 1:1 por número
 * (`@s.whatsapp.net`) o por LID (`@lid`, un identificador opaco que NO es el
 * teléfono). Para el LID el número real viene en `remoteJidAlt`, y si no está
 * se pide al mapa LID→PN de la sesión.
 */
async function resolverTelefono(sock: WASocket, key: WAMessageKey): Promise<string> {
  const jid = key.remoteJid ?? "";
  if (isPnUser(jid)) return jid.split("@")[0];

  if (key.remoteJidAlt && isPnUser(key.remoteJidAlt)) {
    return key.remoteJidAlt.split("@")[0];
  }

  try {
    const pn = await sock.signalRepository.lidMapping.getPNForLID(jid);
    if (pn) return pn.split("@")[0];
  } catch (err) {
    console.warn(`[bot] no se pudo resolver el número de ${jid}:`, err);
  }

  // Sin número: se guarda el LID crudo antes que perder el mensaje.
  console.warn(`[bot] sin número para ${jid}, se guarda con el LID`);
  return jid.split("@")[0];
}

async function responder(
  sock: WASocket,
  jid: string,
  conversacionId: string,
  rol: RolWaMensaje,
  texto: string,
): Promise<void> {
  await insertarMensaje(conversacionId, rol, texto);
  // Responder al jid original: si el chat vino por LID, mandar al número
  // reconstruido abre una conversación distinta.
  await sock.sendMessage(jid, { text: texto });
}

async function procesarMensaje(sock: WASocket, msg: WAMessage): Promise<void> {
  if (msg.key.fromMe) return;

  const jid = msg.key.remoteJid ?? "";
  // Fuera de alcance: grupos, estados/difusión y canales.
  if (isJidGroup(jid) || isJidBroadcast(jid) || isJidNewsletter(jid)) return;
  if (!isPnUser(jid) && !isLidUser(jid)) return;

  const texto = extraerTexto(msg);
  if (!texto) {
    console.log(`[bot] mensaje sin texto de ${jid}, ignorado`);
    return;
  }

  const telefono = await resolverTelefono(sock, msg.key);
  console.log(`[bot] ← mensaje de ${telefono}: ${texto.slice(0, 80)}`);

  const conversacion = await getOrCreateConversacion(telefono, jid, msg.pushName ?? undefined);
  // Lo último que le mandamos ANTES de este mensaje (para saber si responde a
  // un recordatorio).
  const ultimoNuestro = await getUltimoMensajeNuestro(conversacion.id);
  await insertarMensaje(conversacion.id, "cliente", texto);

  // Reconocer al paciente por teléfono. Si falla, el bot igual atiende.
  let paciente: ContextoPaciente | null = null;
  try {
    const pacienteId = await vincularPaciente(conversacion);
    if (pacienteId) paciente = await getContextoPaciente(pacienteId);
  } catch (err) {
    console.error("[bot] no se pudo vincular el paciente:", err);
  }

  const proximo = paciente?.proximosTurnos[0];

  // 1. Pedido de cancelar o cambiar un turno: lo resuelve una persona. El bot
  //    no cancela solo, avisa y deja la conversación marcada en el panel.
  if (paciente && proximo && esPedidoDeCambio(texto)) {
    await marcarAtencion(conversacion.id);
    await registrarEventoTurno(proximo.id, `Pidió cambiar o cancelar por WhatsApp: "${texto.slice(0, 200)}"`);
    await responder(
      sock,
      jid,
      conversacion.id,
      "ia",
      `Gracias por avisar, ${nombrePila(paciente.nombre)}. Le pasamos tu mensaje al equipo ` +
        `para ver tu turno del ${fechaLarga(proximo.fecha)} a las ${proximo.hora} hs y te escribimos a la brevedad.`,
    );
    console.log(`[bot] ${telefono} pidió cambio de turno: derivado`);
    return;
  }

  // 2. "Sí" en respuesta a un recordatorio: confirma el próximo turno. Solo los
  //    recordatorios se guardan con rol 'sistema'.
  const respondeRecordatorio =
    ultimoNuestro?.rol === "sistema" && ultimoNuestro.horas <= HORAS_RESPUESTA_RECORDATORIO;
  if (paciente && proximo && respondeRecordatorio && esConfirmacion(texto)) {
    if (proximo.estado === "pendiente") await confirmarTurno(proximo.id);
    await responder(
      sock,
      jid,
      conversacion.id,
      "ia",
      `¡Gracias, ${nombrePila(paciente.nombre)}! Tu turno del ${fechaLarga(proximo.fecha)} ` +
        `a las ${proximo.hora} hs quedó confirmado. Te esperamos.`,
    );
    console.log(`[bot] ${telefono} confirmó su turno`);
    return;
  }

  // 3. Charla libre. Re-leer el modo: el toggle del panel pudo cambiar.
  const modo = await getModo(conversacion.id);
  if (modo !== "ia") return;

  if (!hayLlm()) {
    // Sin OpenAI configurado el bot no improvisa: deja la charla para el equipo.
    await marcarAtencion(conversacion.id);
    return;
  }

  let respuesta: string;
  try {
    const [historial, consultorio] = await Promise.all([
      getHistorialReciente(conversacion.id),
      getConsultorio(),
    ]);
    respuesta = await generarRespuesta(historial, consultorio, paciente);
  } catch (err) {
    console.error("[bot] error del LLM (no se responde):", err);
    await marcarAtencion(conversacion.id);
    return;
  }

  const derivar = respuesta.includes(MARCA_DERIVAR);
  respuesta = respuesta.replaceAll(MARCA_DERIVAR, "").trim();
  if (respuesta) await responder(sock, jid, conversacion.id, "ia", respuesta);
  if (derivar) {
    await marcarAtencion(conversacion.id);
    console.log(`[bot] ${telefono} derivado al equipo`);
  }
}
