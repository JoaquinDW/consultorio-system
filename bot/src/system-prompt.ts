import { readFile } from "node:fs/promises";
import type { Consultorio, ContextoPaciente } from "./db.js";
import { fechaLarga } from "./mensajes.js";

/**
 * El "cerebro" del bot se arma en capas, en cada mensaje:
 *
 * 1. `project.md` — la info del consultorio (tono, horarios, dirección, qué no
 *    decir). Lo edita el consultorio sin tocar código; guardar aplica al toque.
 * 2. Datos en vivo del sistema: nombre, profesionales y la fecha de hoy.
 * 3. Si el que escribe es un paciente conocido: su nombre y próximos turnos.
 */

const RUTA_PROJECT_MD = new URL("../project.md", import.meta.url);

/** Marca que el LLM agrega al final cuando la charla la tiene que seguir una persona. */
export const MARCA_DERIVAR = "[DERIVAR]";

let ultimoProjectMd: string | null = null;

const FALLBACK = `
Sos el asistente virtual de un consultorio. Atendés por WhatsApp en español
rioplatense (vos, no tú), en mensajes cortos y amables.
Nunca des consejos médicos ni hables de diagnósticos o tratamientos.
No confirmes turnos nuevos ni horarios: tomá el pedido y avisá que el equipo
lo confirma. Ante cualquier duda, derivá a una persona.
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

function bloqueConsultorio(c: Consultorio): string {
  const profesionales =
    c.profesionales.length === 0
      ? "- (no hay profesionales cargados)"
      : c.profesionales
          .map((p) => `- ${p.nombre}${p.especialidad ? ` (${p.especialidad})` : ""}`)
          .join("\n");
  return [
    "## Datos del sistema (en vivo)",
    "",
    `- Consultorio: ${c.nombre}`,
    `- Hoy es ${fechaLarga(hoyEn(c.zonaHoraria))} (zona ${c.zonaHoraria}).`,
    "- Profesionales que atienden:",
    profesionales,
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

const REGLA_DERIVAR = [
  "## Cómo derivar",
  "",
  `Cuando la charla la tenga que seguir una persona (pedir, cambiar o cancelar un turno,`,
  `algo que no sabés, una urgencia o una queja), respondé avisando que le pasás el mensaje`,
  `al equipo y agregá al final, en una línea sola, exactamente ${MARCA_DERIVAR}.`,
  "El paciente no ve esa marca: el sistema la saca y avisa al equipo.",
].join("\n");

export async function construirSystemPrompt(
  consultorio: Consultorio,
  paciente: ContextoPaciente | null,
): Promise<string> {
  const projectMd = await leerProjectMd();
  return [projectMd, bloqueConsultorio(consultorio), bloquePaciente(paciente), REGLA_DERIVAR].join(
    "\n\n---\n\n",
  );
}
