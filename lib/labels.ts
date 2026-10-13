import type {
  CanalRecordatorio,
  EstadoConexionWa,
  EstadoTurno,
  ModoWa,
  Rol,
} from "./types";

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
  whatsapp_manual: "WhatsApp (a mano)",
  copiado: "Copiado",
  whatsapp_bot: "Bot de WhatsApp",
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

export const ESTADOS_CONEXION_WA: Record<
  EstadoConexionWa,
  { etiqueta: string; className: string }
> = {
  desconectado: {
    etiqueta: "Desconectado",
    className: "border-border bg-muted text-muted-foreground",
  },
  qr: {
    etiqueta: "Esperando escaneo",
    className: "border-warning/40 bg-warning/10 text-warning",
  },
  conectando: {
    etiqueta: "Conectando",
    className: "border-warning/40 bg-warning/10 text-warning",
  },
  conectado: {
    etiqueta: "Conectado",
    className: "border-success/40 bg-success/10 text-success",
  },
};

export const MODOS_WA: Record<ModoWa, { etiqueta: string; className: string }> = {
  ia: { etiqueta: "Bot", className: "border-primary/30 bg-primary/5 text-primary" },
  humano: {
    etiqueta: "Humano",
    className: "border-warning/40 bg-warning/10 text-warning",
  },
};
