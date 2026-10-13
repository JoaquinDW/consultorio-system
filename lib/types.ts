export type Rol = "administrador" | "recepcion";

export type EstadoTurno = "pendiente" | "confirmado" | "cancelado" | "realizado";

export type CanalRecordatorio = "whatsapp_manual" | "copiado" | "whatsapp_bot";

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

export interface Lugar {
  id: string;
  nombre: string;
  direccion: string | null;
  activo: boolean;
}

/**
 * Servicio que ofrece el consultorio. `lugarId`/`profesionalId` nulos = en
 * todos los lugares / con cualquier profesional. Los precios diferenciados
 * nulos significan que se cobra el de lista.
 */
export interface Servicio {
  id: string;
  nombre: string;
  lugarId: string | null;
  lugarNombre: string | null;
  profesionalId: string | null;
  profesionalNombre: string | null;
  duracionMin: number;
  precio: number;
  precioEfectivo: number | null;
  precioTransferencia: number | null;
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
  servicioId: string | null;
  servicioNombre: string | null;
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

// --- WhatsApp (bot de Baileys, tablas wa_*) -----------------------------------

export type ModoWa = "ia" | "humano";

/** sistema = recordatorio de turno; ia = respuesta del bot; humano = alguien del equipo. */
export type RolWaMensaje = "cliente" | "ia" | "humano" | "sistema";

export type EstadoConexionWa = "desconectado" | "qr" | "conectando" | "conectado";

export interface WaEstadoConexion {
  estado: EstadoConexionWa;
  telefono: string | null;
  /** QR como data-url PNG, listo para un <img>. */
  qr: string | null;
  actualizadoEn: string;
}

export interface WaConversacion {
  id: string;
  telefono: string;
  nombre: string | null;
  modo: ModoWa;
  pacienteId: string | null;
  pacienteNombre: string | null;
  requiereAtencion: boolean;
  ultimoMensaje: string | null;
  ultimoMensajeEn: string | null;
}

export interface WaMensaje {
  id: string;
  rol: RolWaMensaje;
  contenido: string;
  creadoEn: string;
}

/** Lo que muestra la ficha al costado del chat. */
export interface FichaPacienteWa {
  id: string;
  nombre: string;
  telefono: string;
  email: string | null;
  nota: string | null;
  proximosTurnos: {
    id: string;
    fecha: string;
    hora: string;
    estado: EstadoTurno;
    profesional: string | null;
  }[];
}
