/**
 * Textos y reglas puras del bot. El mensaje de recordatorio es el mismo que arma
 * el panel (lib/recordatorios.ts en la app): mantener los dos en sync.
 */

/** "martes 14 de octubre". */
export function fechaLarga(fecha: string): string {
  return new Date(`${fecha}T00:00:00Z`)
    .toLocaleDateString("es-AR", {
      timeZone: "UTC",
      weekday: "long",
      day: "numeric",
      month: "long",
    })
    .replace(",", "");
}

export function nombrePila(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? nombre;
}

/** Sin información clínica: nombre, fecha, hora y quién atiende. */
export function mensajeRecordatorio({
  pacienteNombre,
  fecha,
  hora,
  consultorio,
  profesional,
}: {
  pacienteNombre: string;
  fecha: string;
  hora: string;
  consultorio: string;
  profesional: string | null;
}): string {
  const conQuien = profesional ? ` con ${profesional}` : "";
  return (
    `¡Hola ${nombrePila(pacienteNombre)}! Te recordamos tu turno en ${consultorio}${conQuien} ` +
    `el ${fechaLarga(fecha)} a las ${hora} hs. ` +
    `Si no podés venir o necesitás cambiar el horario, respondé este mensaje. ¡Gracias!`
  );
}

/**
 * Teléfono → número de WhatsApp (solo dígitos, con código de país). Mismo
 * criterio que el panel: un número local argentino de 10 dígitos lleva 549.
 */
export function numeroWhatsapp(telefono: string): string | null {
  let digitos = telefono.replace(/\D/g, "");
  if (digitos.startsWith("00")) digitos = digitos.slice(2);
  if (digitos.startsWith("0")) digitos = digitos.slice(1);
  if (digitos.length === 10) digitos = `549${digitos}`;
  return digitos.length >= 11 && digitos.length <= 15 ? digitos : null;
}

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Respuesta corta afirmativa a un recordatorio ("sí", "confirmo", "dale",
 * "ok, ahí estaré"). A propósito es estricta: ante la duda no se confirma nada
 * y la charla sigue por el camino normal.
 */
export function esConfirmacion(texto: string): boolean {
  const t = normalizar(texto);
  if (!t || t.split(" ").length > 8) return false;
  if (/\b(no|cancel|reprogram|cambi|otro dia|otra hora|no puedo)/.test(t)) return false;
  return /^(si|sii+|siii*|confirmo|confirmado|confirmamos|dale|ok|okey|okay|perfecto|de una|listo|joya|genial|buenisimo|ahi estare|ahi estoy|alli estare|voy|vamos|claro|por supuesto|obvio)\b/.test(
    t,
  );
}

/** Pedido de cancelar o cambiar el turno: lo resuelve una persona. */
export function esPedidoDeCambio(texto: string): boolean {
  const t = normalizar(texto);
  return /\b(cancel\w*|reprogram\w*|cambi\w*|posterg\w*|suspend\w*|no (voy|puedo|llego|podre|vamos)|otro dia|otra hora|otro horario|mas tarde|mas temprano)\b/.test(
    t,
  );
}
