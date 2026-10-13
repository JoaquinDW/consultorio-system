import type { ChatCompletionTool } from "openai/resources/chat/completions";
import { agendarTurno, buscarDisponibilidad, faltaNombre } from "./agenda.js";
import type { WaConversacionFila } from "./db.js";

/**
 * Herramientas que el LLM puede llamar para dar turnos. Solo se le ofrecen si
 * en Configuración está prendido "El bot puede dar turnos".
 */

export const DEFINICIONES: ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "consultar_disponibilidad",
      description:
        "Horarios libres en la agenda para un servicio, respetando el horario de atención y los turnos ya dados. " +
        "Devuelve, por día y profesional, las horas en que se puede empezar el turno.",
      parameters: {
        type: "object",
        properties: {
          nombre_completo: {
            type: "string",
            description: "Nombre y apellido del paciente (si ya figura completo en \"Quién escribe\", ese).",
          },
          servicio_id: { type: "string", description: "id del servicio, de la lista de servicios." },
          profesional_id: {
            type: "string",
            description: "id del profesional, si el paciente eligió uno. Omitir si le da igual.",
          },
          desde: {
            type: "string",
            description: "Primer día a buscar, YYYY-MM-DD tomado del calendario. Por defecto, hoy.",
          },
          dias: { type: "integer", description: "Cuántos días buscar desde `desde` (1 a 14). Por defecto 7." },
        },
        required: ["nombre_completo"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "agendar_turno",
      description:
        "Reserva el turno a nombre de quien escribe. Usala solo después de que el paciente confirmó " +
        "explícitamente servicio, profesional, día y hora, y con un horario que devolvió consultar_disponibilidad.",
      parameters: {
        type: "object",
        properties: {
          nombre_completo: { type: "string", description: "Nombre y apellido del paciente." },
          servicio_id: { type: "string" },
          profesional_id: {
            type: "string",
            description: "El profesional_id del horario elegido (si tenía).",
          },
          fecha: { type: "string", description: "YYYY-MM-DD, la `fecha` del horario elegido o del calendario." },
          hora: { type: "string", description: "HH:MM, hora de inicio." },
        },
        required: ["nombre_completo", "fecha", "hora"],
        additionalProperties: false,
      },
    },
  },
];

function texto(valor: unknown): string | undefined {
  return typeof valor === "string" && valor.trim() ? valor.trim() : undefined;
}

/** Ejecuta una herramienta y devuelve el resultado como JSON para el LLM. */
export async function ejecutarHerramienta(
  conversacion: WaConversacionFila,
  nombre: string,
  argumentos: string,
): Promise<string> {
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argumentos || "{}") as Record<string, unknown>;
  } catch {
    return JSON.stringify({ error: "Argumentos inválidos." });
  }

  switch (nombre) {
    case "consultar_disponibilidad": {
      const sinNombre = await faltaNombre(conversacion, texto(args.nombre_completo));
      if (sinNombre) return JSON.stringify({ error: sinNombre });
      return JSON.stringify(
        await buscarDisponibilidad({
          servicioId: texto(args.servicio_id),
          profesionalId: texto(args.profesional_id),
          desde: texto(args.desde),
          dias: typeof args.dias === "number" ? args.dias : undefined,
        }),
      );
    }
    case "agendar_turno": {
      const resultado = await agendarTurno(conversacion, {
        nombreCompleto: texto(args.nombre_completo),
        servicioId: texto(args.servicio_id),
        profesionalId: texto(args.profesional_id),
        fecha: texto(args.fecha),
        hora: texto(args.hora),
      });
      if (resultado.ok) {
        console.log(
          `[bot] turno agendado por WhatsApp: ${resultado.turno.fecha} ${resultado.turno.hora} (${conversacion.telefono})`,
        );
      }
      return JSON.stringify(resultado);
    }
    default:
      return JSON.stringify({ error: `No existe la herramienta ${nombre}.` });
  }
}
