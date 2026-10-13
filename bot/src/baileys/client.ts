import baileys, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  fetchLatestWaWebVersion,
  useMultiFileAuthState,
  type ConnectionState,
  type WASocket,
} from "@whiskeysockets/baileys";
import pino from "pino";
import qrcodeTerminal from "qrcode-terminal";
import { rm } from "node:fs/promises";
import { getEstadoConexion, getJidPorTelefono, setEstadoConexion } from "../db.js";
import { registrarHandlers } from "./handler.js";

// Interop CJS/ESM: según el runtime, makeWASocket puede venir como default
// directo o anidado en .default.
const makeWASocket: typeof baileys =
  (baileys as unknown as { default?: typeof baileys }).default ?? baileys;

/** Sesión de Baileys, montada como volumen (./data/wa-auth en el host). */
const RUTA_AUTH = "./auth";

let sock: WASocket | null = null;
let reconexionProgramada: NodeJS.Timeout | null = null;

export function getSocket(): WASocket | null {
  return sock;
}

export async function iniciarBaileys(): Promise<void> {
  // Anunciar una versión vieja de WA Web hace que el teléfono rechace el
  // pairing ("no se pueden vincular nuevos dispositivos en este momento").
  // fetchLatestWaWebVersion consulta a los servidores de WhatsApp; el JSON
  // estático de fetchLatestBaileysVersion queda como respaldo y suele atrasar.
  let version: [number, number, number] | undefined;
  try {
    version = (await fetchLatestWaWebVersion({})).version;
  } catch (err) {
    console.warn("[bot] no se pudo obtener la versión de WA Web, uso el respaldo:", err);
    try {
      version = (await fetchLatestBaileysVersion()).version;
    } catch (err2) {
      console.warn("[bot] tampoco el respaldo; se usa la default de Baileys:", err2);
    }
  }
  console.log(`[bot] versión de WA Web anunciada: ${version?.join(".") ?? "default"}`);

  const { state, saveCreds } = await useMultiFileAuthState(RUTA_AUTH);

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: "silent" }),
    // Un browser custom dispara loops de code 440 (connectionReplaced).
    browser: Browsers.macOS("Desktop"),
    markOnlineOnConnect: false,
    syncFullHistory: false,
  });

  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", (update) => {
    void manejarConnectionUpdate(update).catch((err) =>
      console.error("[bot] error en connection.update:", err),
    );
  });
  registrarHandlers(sock);
}

async function manejarConnectionUpdate(update: Partial<ConnectionState>): Promise<void> {
  const { connection, lastDisconnect, qr } = update;

  if (qr) {
    await setEstadoConexion({ estado: "qr", qr_string: qr, telefono: null });
    console.log("[bot] QR nuevo: escanealo desde el panel (/whatsapp). ASCII de respaldo:");
    qrcodeTerminal.generate(qr, { small: true });
  }

  if (connection === "connecting") {
    // Solo desde 'desconectado': no degradar 'qr' ni 'conectado'.
    const actual = await getEstadoConexion();
    if (actual.estado === "desconectado") {
      await setEstadoConexion({ estado: "conectando" });
    }
  }

  if (connection === "open") {
    const id = sock?.user?.id ?? "";
    // Formato "5491155...:N@s.whatsapp.net" → quedarse con la parte numérica.
    const telefono = id.split(":")[0].split("@")[0] || null;
    await setEstadoConexion({ estado: "conectado", qr_string: null, telefono });
    console.log(`[bot] conectado como ${telefono}`);
  }

  if (connection === "close") {
    const code = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)
      ?.output?.statusCode;

    if (code === DisconnectReason.loggedOut) {
      console.log("[bot] sesión cerrada desde el teléfono (401): no se reconecta");
      await setEstadoConexion({ estado: "desconectado", qr_string: null, telefono: null });
      return;
    }

    // Cierre transitorio: no tocar el estado en la DB, solo reconectar.
    // 440 (connectionReplaced) necesita más espera o entra en loop.
    const delay = code === 440 ? 15000 : 5000;
    console.log(`[bot] conexión cerrada (code ${code ?? "?"}), reintento en ${delay / 1000}s`);
    programarReconexion(delay);
  }
}

function programarReconexion(delay: number): void {
  if (reconexionProgramada) return;
  reconexionProgramada = setTimeout(() => {
    reconexionProgramada = null;
    void reconectar();
  }, delay);
}

async function reconectar(): Promise<void> {
  try {
    // Cerrar el socket viejo: sin esto quedan listeners colgando que se
    // mezclan con la conexión nueva.
    sock?.end(undefined);
  } catch {
    // ya estaba cerrado
  }
  sock = null;
  try {
    await iniciarBaileys();
  } catch (err) {
    console.error("[bot] fallo la reconexión, reintento en 5s:", err);
    programarReconexion(5000);
  }
}

export async function enviarTexto(telefono: string, texto: string): Promise<void> {
  if (!sock) throw new Error("sin conexión de WhatsApp");
  // El chat puede estar direccionado por LID: hay que responder al mismo jid
  // por el que entró. El fallback al número cubre las filas viejas (sin jid).
  const jid = (await getJidPorTelefono(telefono)) ?? `${telefono}@s.whatsapp.net`;
  await sock.sendMessage(jid, { text: texto });
}

/**
 * Desconexión manual desde el panel: cierra la sesión, borra la carpeta
 * auth/ y arranca una conexión limpia (genera QR nuevo).
 */
export async function reinicioLimpio(): Promise<void> {
  if (reconexionProgramada) {
    clearTimeout(reconexionProgramada);
    reconexionProgramada = null;
  }
  try {
    await sock?.logout();
  } catch {
    // sin sesión activa
  }
  try {
    sock?.end(undefined);
  } catch {
    // ya estaba cerrado
  }
  sock = null;
  await rm(RUTA_AUTH, { recursive: true, force: true });
  await setEstadoConexion({ estado: "desconectado", qr_string: null, telefono: null });
  await iniciarBaileys();
}
