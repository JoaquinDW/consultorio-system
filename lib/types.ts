export type Rol = "administrador" | "recepcion";

export type EstadoTurno = "pendiente" | "confirmado" | "cancelado" | "realizado";

export type CanalRecordatorio = "whatsapp_manual" | "copiado";

export interface Consultorio {
  nombre: string;
  zonaHoraria: string;
  duracionTurnoMin: number;
  recordatorioHorasAntes: number;
}

export interface Profesional {
  id: string;
  nombre: string;
  especialidad: string | null;
  activo: boolean;
}

export interface Paciente {
  id: string;
  nombre: string;
  telefono: string;
  email: string | null;
  nota: string | null;
  archivado: boolean;
  /** Próximo turno activo (pendiente o confirmado), en la zona del consultorio. */
  proximoTurno: { fecha: string; hora: string } | null;
}

/**
 * Turno ya traducido a la zona horaria del consultorio: `fecha` es
 * "YYYY-MM-DD" y `hora`/`horaFin` son "HH:MM" locales. La capa de datos hace la
 * conversión en Postgres, así la UI nunca depende de la zona del navegador.
 */
export interface Turno {
  id: string;
  pacienteId: string;
  pacienteNombre: string;
  pacienteTelefono: string;
  profesionalId: string | null;
  profesionalNombre: string | null;
  fecha: string;
  hora: string;
  horaFin: string;
  duracionMin: number;
  estado: EstadoTurno;
  nota: string | null;
  /** True si el turno ya empezó. */
  pasado: boolean;
  /** Recordatorio enviado para el horario actual del turno (no para uno anterior). */
  recordatorioEnviadoEn: string | null;
  mensajeRecordatorio: string;
}

export interface RecordatorioEnviado {
  id: string;
  turnoId: string;
  pacienteNombre: string;
  fechaTurno: string;
  horaTurno: string;
  canal: CanalRecordatorio;
  enviadoPor: string | null;
  enviadoEn: string;
  /** False si el turno se reprogramó después de enviar este recordatorio. */
  vigente: boolean;
}
