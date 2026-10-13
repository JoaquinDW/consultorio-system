import { readFile } from "node:fs/promises";
import type { ServicioBot } from "./agenda.js";
import type { Consultorio, ContextoPaciente } from "./db.js";
import { fechaLarga } from "./mensajes.js";

/**
 * El "cerebro" del bot se arma en capas, en cada mensaje:
 *
 * 1. `project.md` — la info del consultorio (tono, horarios, dirección, qué no
 *    decir). Lo edita el consultorio sin tocar código; guardar aplica al toque.
 * 2. Datos en vivo del sistema: nombre, profesionales y la fecha de hoy.
 * 3. Si el que escribe es un paciente conocido: su nombre y próximos turnos.
 * 4. Cómo tomar un turno nuevo: darlo el bot (si está prendido en
 *    Configuración) o juntar los datos y derivar.
 */

export interface ContextoPrompt {
  /** "El bot puede dar turnos" (Configuración → WhatsApp). */
  agendaActiva: boolean;
  servicios: ServicioBot[];
}

const RUTA_PROJECT_MD = new URL("../project.md", import.meta.url);

/** Marca que el LLM agrega al final cuando la charla la tiene que seguir una persona. */
export const MARCA_DERIVAR = "[DERIVAR]";

let ultimoProjectMd: string | null = null;

const FALLBACK = `
Sos el asistente virtual de un consultorio. Atendés por WhatsApp en español
rioplatense (vos, no tú), en mensajes cortos y amables.
Nunca des consejos médicos ni hables de diagnósticos o tratamientos.
Ante cualquier duda, derivá a una persona.
`.trim();

async function leerProjectMd(): Promise<string> {
  try {
    ultimoProjectMd = await readFile(RUTA_PROJECT_MD, "utf8");
  } catch (err) {
    if (ultimoProjectMd === null) {
      console.error("[bot] no se pudo leer project.md, uso el prompt mínimo:", err);
      return FALLBACK;
    }
    console.error("[bot] no se pudo releer project.md, sigo con la última versión buena:", err);
  }
  return ultimoProjectMd;
}

function hoyEn(zona: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: zona }).format(new Date());
}

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/**
 * Calendario de las próximas dos semanas con la fecha ISO de cada día. Los
 * resultados de las herramientas no quedan en el historial: cuando el paciente
 * dice "dale" o "el jueves", el LLM tiene que reconstruir la fecha y, sin esto,
 * le pifia al año o al día de la semana.
 */
function calendario(hoy: string): string {
  return Array.from({ length: 15 }, (_, i) => {
    const fecha = sumarDias(hoy, i);
    return `- ${fechaLarga(fecha)} = ${fecha}${i === 0 ? " (hoy)" : i === 1 ? " (mañana)" : ""}`;
  }).join("\n");
}

function bloqueConsultorio(c: Consultorio): string {
  const profesionales =
    c.profesionales.length === 0
      ? "- (no hay profesionales cargados)"
      : c.profesionales
          .map(
            (p) =>
              `- ${p.nombre}${p.especialidad ? ` (${p.especialidad})` : ""} [profesional_id: ${p.id}]`,
          )
          .join("\n");
  const hoy = hoyEn(c.zonaHoraria);
  return [
    "## Datos del sistema (en vivo)",
    "",
    `- Consultorio: ${c.nombre}`,
    `- Hoy es ${fechaLarga(hoy)} de ${hoy.slice(0, 4)} (${hoy}, zona ${c.zonaHoraria}).`,
    "- Profesionales que atienden (la especialidad no es un servicio):",
    profesionales,
    "",
    "Próximos días. Para pasar una fecha a una herramienta, buscala acá y usá la fecha",
    "YYYY-MM-DD exacta; nunca calcules vos el año ni el día de la semana:",
    calendario(hoy),
  ].join("\n");
}

function bloquePaciente(p: ContextoPaciente | null): string {
  if (!p) {
    return [
      "## Quién escribe",
      "",
      "No lo tenemos registrado como paciente (o escribe desde otro número).",
      "No le des información de turnos de nadie.",
    ].join("\n");
  }
  const turnos =
    p.proximosTurnos.length === 0
      ? "- No tiene turnos próximos."
      : p.proximosTurnos
          .map(
            (t) =>
              `- ${fechaLarga(t.fecha)} a las ${t.hora} hs` +
              `${t.profesional ? ` con ${t.profesional}` : ""} (${t.estado})`,
          )
          .join("\n");
  return [
    "## Quién escribe",
    "",
    `Paciente registrado: ${p.nombre}. Sus próximos turnos:`,
    turnos,
    "",
    "Podés decirle sus turnos tal cual figuran acá. No inventes otros.",
  ].join("\n");
}

function bloqueServicios(servicios: ServicioBot[]): string {
  if (servicios.length === 0) {
    return ["## Servicios", "", "No hay servicios cargados: no hace falta preguntar cuál quiere."].join("\n");
  }
  return [
    "## Servicios que se pueden pedir",
    "",
    ...servicios.map(
      (s) =>
        `- ${s.nombre} (${s.duracionMin} min)` +
        `${s.profesional ? `, con ${s.profesional}` : ""}` +
        `${s.lugar ? `, en ${s.lugar}` : ""} [servicio_id: ${s.id}]`,
    ),
    "",
    "Los ids son internos: no se los muestres al paciente.",
  ].join("\n");
}

const DATOS_TURNO_NUEVO = [
  "- Nombre y apellido: si no figura en \"Quién escribe\", o figura solo el nombre de pila, pedíselo",
  "  (aunque se presente con el nombre, hace falta el apellido).",
  "- Qué servicio quiere, de la lista de servicios (si hay). Preguntá solo cuál servicio: nunca",
  "  síntomas, motivos médicos ni datos clínicos. Si lo que pide no encaja con ningún servicio, derivá.",
  "- Con qué profesional, si el servicio no tiene uno fijo y atiende más de uno (o si le da igual).",
].join("\n");

function bloqueTurnosNuevos(agendaActiva: boolean): string {
  if (!agendaActiva) {
    return [
      "## Turnos nuevos",
      "",
      "Esto manda sobre lo que diga más arriba sobre sacar turnos. Vos no das turnos ni horarios:",
      "los confirma el equipo. Antes de derivar, conseguí estos datos (de a uno o dos por mensaje,",
      "sin volver a pedir lo que ya te dijo):",
      "",
      DATOS_TURNO_NUEVO,
      "- Qué días y horarios le quedan cómodos.",
      "",
      "Con eso, avisá que el equipo le confirma el turno y derivá. Si no quiere dar algún dato o",
      "insiste en hablar con una persona, derivá igual.",
    ].join("\n");
  }
  return [
    "## Turnos nuevos (los das vos)",
    "",
    "Esto manda sobre lo que diga más arriba sobre sacar turnos: podés dar turnos con las",
    "herramientas `consultar_disponibilidad` y `agendar_turno`. Seguí estos pasos en orden (pedí",
    "de a uno o dos datos por mensaje, sin volver a pedir lo que ya te dijo). No busques ni",
    "ofrezcas horarios hasta tener el nombre y apellido y el servicio, aunque el paciente ya",
    "te diga un día:",
    "",
    DATOS_TURNO_NUEVO,
    "- Buscá lugar con `consultar_disponibilidad`. Si dijo un día, pasá `desde` con la fecha de",
    "  ese día sacada del calendario de arriba y `dias: 1`; si ese día no hay lugar, buscá de nuevo",
    "  sin `dias` para ofrecer los más cercanos. Ofrecé 2 o 3 opciones de las que devuelve, nombrando",
    "  el día con el campo `dia` tal cual. Nunca ofrezcas un horario que la herramienta no devolvió",
    "  ni inventes disponibilidad.",
    "- Antes de reservar, repetí servicio, profesional, día y hora, y pedí que confirme.",
    "- Con su confirmación, usá `agendar_turno`. Si sale bien, confirmale el turno con día, hora y",
    "  profesional. Si da error, explicale con tus palabras y ofrecé otro horario, o derivá si el",
    "  error lo pide.",
    "- Si ya tiene un turno próximo y quiere otro, o algo no se puede resolver con las herramientas, derivá.",
  ].join("\n");
}

const REGLA_FORMATO = [
  "## Formato",
  "",
  "Escribís en WhatsApp: texto plano, sin markdown (nada de **, #, tablas ni listas con viñetas).",
  "Si tenés que resumir datos, hacelo en una o dos oraciones.",
].join("\n");

const REGLA_DERIVAR = [
  "## Cómo derivar",
  "",
  `Cuando la charla la tenga que seguir una persona (cambiar o cancelar un turno, un turno`,
  `nuevo que no podés dar vos, algo que no sabés, una urgencia o una queja), respondé avisando`,
  `que le pasás el mensaje al equipo y agregá al final, en una línea sola, exactamente ${MARCA_DERIVAR}.`,
  "El paciente no ve esa marca: el sistema la saca y avisa al equipo.",
].join("\n");

export async function construirSystemPrompt(
  consultorio: Consultorio,
  paciente: ContextoPaciente | null,
  { agendaActiva, servicios }: ContextoPrompt,
): Promise<string> {
  const projectMd = await leerProjectMd();
  return [
    projectMd,
    bloqueConsultorio(consultorio),
    bloquePaciente(paciente),
    bloqueServicios(servicios),
    bloqueTurnosNuevos(agendaActiva),
    REGLA_FORMATO,
    REGLA_DERIVAR,
  ].join("\n\n---\n\n");
}
