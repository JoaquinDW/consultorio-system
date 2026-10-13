import type { FranjaHorario } from "./types";

/**
 * Horarios de atención. Módulo puro: lo usan la validación de turnos (servidor)
 * y la agenda (para mostrar el horario del día).
 */

export const DIAS_SEMANA = [
  { valor: 1, etiqueta: "Lunes", corta: "Lun", plural: "lunes" },
  { valor: 2, etiqueta: "Martes", corta: "Mar", plural: "martes" },
  { valor: 3, etiqueta: "Miércoles", corta: "Mié", plural: "miércoles" },
  { valor: 4, etiqueta: "Jueves", corta: "Jue", plural: "jueves" },
  { valor: 5, etiqueta: "Viernes", corta: "Vie", plural: "viernes" },
  { valor: 6, etiqueta: "Sábado", corta: "Sáb", plural: "sábados" },
  { valor: 7, etiqueta: "Domingo", corta: "Dom", plural: "domingos" },
];

/** Día ISO (1 = lunes … 7 = domingo) de una fecha "YYYY-MM-DD". */
export function diaSemana(fecha: string): number {
  const d = new Date(`${fecha}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

function aMinutos(hora: string): number {
  return Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
}

function aHora(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/**
 * Franjas que rigen para un profesional (o para la agenda sin profesional):
 * las propias si tiene alguna, si no las generales. `null` = no hay horarios
 * cargados y no se restringe nada.
 */
export function franjasQueRigen(
  franjas: FranjaHorario[],
  profesionalId: string | null,
): FranjaHorario[] | null {
  const propias = profesionalId
    ? franjas.filter((f) => f.profesionalId === profesionalId)
    : [];
  if (propias.length > 0) return propias;
  const generales = franjas.filter((f) => f.profesionalId === null);
  return generales.length > 0 ? generales : null;
}

/** Franjas de un día, ordenadas por hora. */
export function franjasDelDia(franjas: FranjaHorario[], fecha: string): FranjaHorario[] {
  const dia = diaSemana(fecha);
  return franjas
    .filter((f) => f.diaSemana === dia)
    .sort((a, b) => a.desde.localeCompare(b.desde));
}

/**
 * "de 09:00 a 13:00 y de 14:00 a 19:00"; compacto: "09:00–13:00 · 14:00–19:00".
 */
export function textoFranjas(franjas: FranjaHorario[], compacto = false): string {
  if (compacto) return franjas.map((f) => `${f.desde}–${f.hasta}`).join(" · ");
  const partes = franjas.map((f) => `de ${f.desde} a ${f.hasta}`);
  if (partes.length <= 1) return partes.join("");
  return `${partes.slice(0, -1).join(", ")} y ${partes.at(-1)}`;
}

/**
 * Valida que el turno entre completo en una franja del día. Devuelve el
 * mensaje de error o `null` si está bien.
 */
export function errorDeHorario({
  franjas,
  profesionalId,
  profesionalNombre,
  lugarId,
  fecha,
  hora,
  duracion,
}: {
  franjas: FranjaHorario[];
  profesionalId: string | null;
  profesionalNombre: string | null;
  /** Lugar del servicio del turno, si tiene. */
  lugarId: string | null;
  fecha: string;
  hora: string;
  duracion: number;
}): string | null {
  const rigen = franjasQueRigen(franjas, profesionalId);
  if (!rigen) return null;

  const quien =
    profesionalNombre && rigen.some((f) => f.profesionalId !== null)
      ? profesionalNombre
      : "El consultorio";
  const nombreDia = DIAS_SEMANA[diaSemana(fecha) - 1].plural;
  const delDia = franjasDelDia(rigen, fecha);
  if (delDia.length === 0) return `${quien} no atiende los ${nombreDia}.`;

  const inicio = aMinutos(hora);
  const fin = inicio + duracion;
  const enHorario = delDia.filter(
    (f) => aMinutos(f.desde) <= inicio && fin <= aMinutos(f.hasta),
  );
  if (enHorario.length === 0) {
    return `El turno (${hora}–${aHora(fin)}) queda fuera del horario de atención. Los ${nombreDia} ${quien === "El consultorio" ? "se atiende" : `${quien} atiende`} ${textoFranjas(delDia)}.`;
  }
  if (lugarId && !enHorario.some((f) => f.lugarId === null || f.lugarId === lugarId)) {
    const lugares = [...new Set(enHorario.map((f) => f.lugarNombre).filter(Boolean))];
    return `En ese horario ${quien === "El consultorio" ? "se atiende" : `${quien} atiende`} en ${lugares.join(" o ")}, no en el lugar del servicio elegido.`;
  }
  return null;
}
