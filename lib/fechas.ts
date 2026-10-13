/**
 * Fechas "de calendario" del consultorio como strings "YYYY-MM-DD".
 *
 * Módulo puro (sin server-only): se usa en la UI y en la capa de datos. Toda la
 * aritmética se hace en UTC sobre la fecha sola, así no la mueve la zona
 * horaria del servidor ni la del navegador.
 */

const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const RE_HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

export function esFechaValida(valor: string): boolean {
  if (!RE_FECHA.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === valor;
}

export function esHoraValida(valor: string): boolean {
  return RE_HORA.test(valor);
}

/** Fecha de hoy en la zona horaria indicada. */
export function hoyEn(zonaHoraria: string): string {
  // en-CA formatea como YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: zonaHoraria }).format(
    new Date(),
  );
}

export function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Lunes de la semana de `fecha`. */
export function inicioDeSemana(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  const dia = (d.getUTCDay() + 6) % 7; // lunes = 0
  return sumarDias(fecha, -dia);
}

function comoUtc(fecha: string): Date {
  return new Date(`${fecha}T00:00:00Z`);
}

/** "martes 14 de octubre". */
export function fechaLarga(fecha: string): string {
  return comoUtc(fecha)
    .toLocaleDateString("es-AR", {
      timeZone: "UTC",
      weekday: "long",
      day: "numeric",
      month: "long",
    })
    .replace(",", "");
}

/** "mar 14/10". */
export function fechaCorta(fecha: string): string {
  const d = comoUtc(fecha);
  const dia = d
    .toLocaleDateString("es-AR", { timeZone: "UTC", weekday: "short" })
    .replace(".", "");
  return `${dia} ${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

/** "14 al 20 de octubre". */
export function rangoSemana(lunes: string): string {
  const domingo = sumarDias(lunes, 6);
  const fin = comoUtc(domingo).toLocaleDateString("es-AR", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
  });
  return `${comoUtc(lunes).getUTCDate()} al ${fin}`;
}

/** Desfase actual de la zona respecto de UTC, p. ej. "UTC−03:00". */
export function desfaseZona(zonaHoraria: string): string {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: zonaHoraria,
    timeZoneName: "longOffset",
  }).formatToParts(new Date());
  const nombre = partes.find((p) => p.type === "timeZoneName")?.value ?? "";
  return nombre.replace("GMT", "UTC").replace("-", "−") || "UTC";
}

export function esZonaValida(zonaHoraria: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zonaHoraria });
    return true;
  } catch {
    return false;
  }
}
