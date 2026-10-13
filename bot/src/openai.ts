import OpenAI from "openai";
import { construirSystemPrompt } from "./system-prompt.js";
import type { Consultorio, ContextoPaciente, MensajeHistorial } from "./db.js";

// Lazy: si falta OPENAI_API_KEY el bot igual arranca (recordatorios y
// confirmaciones andan sin LLM); solo no contesta mensajes libres.
let cliente: OpenAI | null = null;

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
 */
export async function generarRespuesta(
  historial: MensajeHistorial[],
  consultorio: Consultorio,
  paciente: ContextoPaciente | null,
): Promise<string> {
  const mensajes = [
    { role: "system" as const, content: await construirSystemPrompt(consultorio, paciente) },
    ...historial.map((m) => ({
      role: m.rol === "cliente" ? ("user" as const) : ("assistant" as const),
      content: m.contenido,
    })),
  ];

  const inicio = Date.now();
  const res = await getCliente().chat.completions.create({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    messages: mensajes,
  });
  console.log(`[bot] LLM respondió en ${Date.now() - inicio}ms`);

  const texto = res.choices[0]?.message?.content?.trim();
  if (!texto) throw new Error("el LLM devolvió una respuesta vacía");
  return texto;
}
