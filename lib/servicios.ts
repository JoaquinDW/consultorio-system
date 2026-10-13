import { formatearPesos } from "./format";
import type { Servicio } from "./types";

/**
 * Precios para mostrar: el de lista y, si hay, los diferenciados por medio de
 * pago. Un diferenciado igual al de lista no se muestra.
 */
export function preciosServicio(
  servicio: Pick<Servicio, "precio" | "precioEfectivo" | "precioTransferencia">,
): { lista: string; efectivo: string | null; transferencia: string | null } {
  const distinto = (p: number | null) =>
    p !== null && p !== servicio.precio ? formatearPesos(p) : null;
  return {
    lista: formatearPesos(servicio.precio),
    efectivo: distinto(servicio.precioEfectivo),
    transferencia: distinto(servicio.precioTransferencia),
  };
}

/** "Consulta · Sede Centro · 30 min", para los selects. */
export function etiquetaServicio(servicio: Servicio): string {
  return [servicio.nombre, servicio.lugarNombre, `${servicio.duracionMin} min`]
    .filter(Boolean)
    .join(" · ");
}
