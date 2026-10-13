import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { construirSystemPrompt, type ContextoPrompt } from "./system-prompt.js";
import { DEFINICIONES, ejecutarHerramienta } from "./herramientas.js";
import type { Consultorio, ContextoPaciente, MensajeHistorial, WaConversacionFila } from "./db.js";

// Lazy: si falta OPENAI_API_KEY el bot igual arranca (recordatorios y
// confirmaciones andan sin LLM); solo no contesta mensajes libres.
let cliente: OpenAI | null = null;

/** Tope de idas y vueltas con herramientas por mensaje del paciente. */
const MAX_RONDAS = 6;

export function hayLlm(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

function getCliente(): OpenAI {
  cliente ??= new OpenAI();
  return cliente;
}

/**
 * Genera la respuesta del bot a partir del historial reciente. Los mensajes
 * 'ia', 'humano' y 'sistema' se mapean a assistant: para el LLM todos salieron
 * del lado del consultorio.
 *
 * Si el bot puede dar turnos, el LLM tiene herramientas para consultar la
 * agenda y reservar; las llamadas no se guardan en el historial, solo la
 * respuesta final.
 */
export async function generarRespuesta(
  historial: MensajeHistorial[],
  consultorio: Consultorio,
  paciente: ContextoPaciente | null,
  contexto: ContextoPrompt & { conversacion: WaConversacionFila },
): Promise<string> {
  const mensajes: ChatCompletionMessageParam[] = [
    { role: "system", content: await construirSystemPrompt(consultorio, paciente, contexto) },
    ...historial.map((m) => ({
      role: m.rol === "cliente" ? ("user" as const) : ("assistant" as const),
      content: m.contenido,
    })),
  ];
  const tools = contexto.agendaActiva ? DEFINICIONES : undefined;

  const inicio = Date.now();
  for (let ronda = 0; ronda < MAX_RONDAS; ronda++) {
    const res = await getCliente().chat.completions.create({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      messages: mensajes,
      tools,
    });
    const mensaje = res.choices[0]?.message;
    const llamadas = mensaje?.tool_calls ?? [];

    if (llamadas.length === 0) {
      console.log(`[bot] LLM respondió en ${Date.now() - inicio}ms`);
      const texto = mensaje?.content?.trim();
      if (!texto) throw new Error("el LLM devolvió una respuesta vacía");
      return texto;
    }

    mensajes.push({ role: "assistant", content: mensaje?.content ?? null, tool_calls: llamadas });
    for (const llamada of llamadas) {
      console.log(`[bot] herramienta ${llamada.function.name} ${llamada.function.arguments}`);
      mensajes.push({
        role: "tool",
        tool_call_id: llamada.id,
        content: await ejecutarHerramienta(
          contexto.conversacion,
          llamada.function.name,
          llamada.function.arguments,
        ),
      });
    }
  }
  throw new Error("el LLM no terminó de responder después de usar herramientas");
}
