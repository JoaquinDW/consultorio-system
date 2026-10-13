import { fechaLarga } from "./fechas";

/**
 * Armado del mensaje de recordatorio. Módulo puro: lo usa la capa de datos
 * para la vista previa y la Server Action para guardar el texto enviado, así
 * los dos coinciden. A propósito NO lleva información clínica: solo nombre,
 * fecha, hora y quién atiende.
 */
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
  const nombrePila = pacienteNombre.trim().split(/\s+/)[0] ?? pacienteNombre;
  const conQuien = profesional ? ` con ${profesional}` : "";
  return (
    `¡Hola ${nombrePila}! Te recordamos tu turno en ${consultorio}${conQuien} ` +
    `el ${fechaLarga(fecha)} a las ${hora} hs. ` +
    `Si no podés venir o necesitás cambiar el horario, respondé este mensaje. ¡Gracias!`
  );
}

/**
 * Teléfono → número para wa.me (solo dígitos, con código de país).
 * Contempla el caso más común en Argentina: un número local de 10 dígitos
 * (característica + número, sin 0 ni 15) al que le falta el 549.
 */
export function numeroWhatsapp(telefono: string): string | null {
  let digitos = telefono.replace(/\D/g, "");
  if (digitos.startsWith("00")) digitos = digitos.slice(2);
  if (digitos.startsWith("0")) digitos = digitos.slice(1);
  if (digitos.length === 10) digitos = `549${digitos}`;
  return digitos.length >= 11 && digitos.length <= 15 ? digitos : null;
}

/** Link que abre WhatsApp (web o app) con el mensaje ya escrito. */
export function linkWhatsapp(telefono: string, mensaje: string): string | null {
  const numero = numeroWhatsapp(telefono);
  if (!numero) return null;
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}
