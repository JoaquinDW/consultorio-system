import type { CanalRecordatorio, EstadoTurno, Rol } from "./types";

export const ESTADOS_TURNO: Record<
  EstadoTurno,
  { etiqueta: string; className: string }
> = {
  pendiente: {
    etiqueta: "Pendiente",
    className: "border-warning/40 bg-warning/10 text-warning",
  },
  confirmado: {
    etiqueta: "Confirmado",
    className: "border-success/40 bg-success/10 text-success",
  },
  cancelado: {
    etiqueta: "Cancelado",
    className: "border-border bg-muted text-muted-foreground line-through",
  },
  realizado: {
    etiqueta: "Realizado",
    className: "border-primary/30 bg-primary/5 text-primary",
  },
};

export const CANALES_RECORDATORIO: Record<CanalRecordatorio, string> = {
  whatsapp_manual: "WhatsApp",
  copiado: "Copiado",
};

export const ROLES: Record<Rol, string> = {
  administrador: "Administrador",
  recepcion: "Recepción",
};

/** Zonas ofrecidas en Configuración (la base acepta cualquier zona IANA). */
export const ZONAS_HORARIAS = [
  "America/Argentina/Buenos_Aires",
  "America/Argentina/Cordoba",
  "America/Argentina/Mendoza",
  "America/Montevideo",
  "America/Santiago",
  "America/Asuncion",
  "America/La_Paz",
  "America/Lima",
  "America/Bogota",
  "America/Mexico_City",
  "Europe/Madrid",
];

export const DURACIONES_TURNO = [10, 15, 20, 30, 40, 45, 60, 90, 120];

/** Valor del select para "sin profesional" (Radix no admite items con value ""). */
export const SIN_PROFESIONAL = "__ninguno";
