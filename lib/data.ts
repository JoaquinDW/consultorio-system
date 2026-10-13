import "server-only";

import { query } from "./db/pool";
import { mensajeRecordatorio } from "./recordatorios";
import type {
  CanalRecordatorio,
  Consultorio,
  EstadoTurno,
  Paciente,
  Profesional,
  RecordatorioEnviado,
  Turno,
} from "./types";

/**
 * Capa de datos: cada función hace `query(...)` y mapea las filas snake_case de
 * Postgres a los tipos de lib/types.ts.
 *
 * Fechas: los turnos se guardan como timestamptz (un instante real) y se
 * traducen a fecha/hora local con la zona del consultorio dentro de Postgres
 * (`at time zone`). La UI recibe strings "YYYY-MM-DD" / "HH:MM" ya resueltos.
 */

// --- Consultorio -----------------------------------------------------------

interface FilaConsultorio {
  nombre: string;
  zona_horaria: string;
  duracion_turno_min: number;
  recordatorio_horas_antes: number;
}

export async function obtenerConsultorio(): Promise<Consultorio> {
  const filas = await query<FilaConsultorio>(
    `select nombre, zona_horaria, duracion_turno_min, recordatorio_horas_antes
     from consultorio where id = 1`,
  );
  const f = filas[0];
  if (!f) {
    throw new Error(
      "Falta la fila de configuración del consultorio. ¿Corriste las migraciones?",
    );
  }
  return {
    nombre: f.nombre,
    zonaHoraria: f.zona_horaria,
    duracionTurnoMin: f.duracion_turno_min,
    recordatorioHorasAntes: f.recordatorio_horas_antes,
  };
}

// --- Profesionales ---------------------------------------------------------

interface FilaProfesional {
  id: string;
  nombre: string;
  especialidad: string | null;
  activo: boolean;
}

function mapearProfesional(f: FilaProfesional): Profesional {
  return {
    id: f.id,
    nombre: f.nombre,
    especialidad: f.especialidad,
    activo: f.activo,
  };
}

export async function obtenerProfesionales({
  incluirInactivos = false,
}: { incluirInactivos?: boolean } = {}): Promise<Profesional[]> {
  const filas = await query<FilaProfesional>(
    `select id, nombre, especialidad, activo from profesionales
     ${incluirInactivos ? "" : "where activo"}
     order by activo desc, nombre`,
  );
  return filas.map(mapearProfesional);
}

// --- Pacientes -------------------------------------------------------------

interface FilaPaciente {
  id: string;
  nombre: string;
  telefono: string;
  email: string | null;
  nota: string | null;
  archivado: boolean;
  proximo_fecha: string | null;
  proximo_hora: string | null;
}

function mapearPaciente(f: FilaPaciente): Paciente {
  return {
    id: f.id,
    nombre: f.nombre,
    telefono: f.telefono,
    email: f.email,
    nota: f.nota,
    archivado: f.archivado,
    proximoTurno:
      f.proximo_fecha && f.proximo_hora
        ? { fecha: f.proximo_fecha, hora: f.proximo_hora }
        : null,
  };
}

/**
 * Busca por nombre (sin distinguir mayúsculas) o por teléfono (comparando solo
 * dígitos, así "351 555-0101" encuentra "+54 9 351 5550101").
 */
export async function obtenerPacientes({
  busqueda = "",
  archivados = false,
}: { busqueda?: string; archivados?: boolean } = {}): Promise<Paciente[]> {
  const texto = busqueda.trim();
  const digitos = texto.replace(/\D/g, "");
  const filas = await query<FilaPaciente>(
    `select p.id, p.nombre, p.telefono, p.email, p.nota, p.archivado,
            to_char(prox.inicio at time zone c.zona_horaria, 'YYYY-MM-DD') as proximo_fecha,
            to_char(prox.inicio at time zone c.zona_horaria, 'HH24:MI') as proximo_hora
     from pacientes p
     cross join (select zona_horaria from consultorio where id = 1) c
     left join lateral (
       select t.inicio from turnos t
       where t.paciente_id = p.id
         and t.estado in ('pendiente', 'confirmado')
         and t.inicio >= now()
       order by t.inicio
       limit 1
     ) prox on true
     where p.archivado = $1
       and (
         $2 = ''
         or p.nombre ilike '%' || $2 || '%'
         or ($3 <> '' and regexp_replace(p.telefono, '\\D', '', 'g') like '%' || $3 || '%')
       )
     order by p.nombre`,
    [archivados, texto, digitos.length >= 3 ? digitos : ""],
  );
  return filas.map(mapearPaciente);
}

export async function contarPacientesActivos(): Promise<number> {
  const filas = await query<{ total: string }>(
    "select count(*) as total from pacientes where not archivado",
  );
  return Number(filas[0]?.total ?? 0);
}

// --- Turnos ----------------------------------------------------------------

interface FilaTurno {
  id: string;
  paciente_id: string;
  paciente_nombre: string;
  paciente_telefono: string;
  profesional_id: string | null;
  profesional_nombre: string | null;
  consultorio_nombre: string;
  fecha: string;
  hora: string;
  hora_fin: string;
  duracion_min: number;
  estado: EstadoTurno;
  nota: string | null;
  pasado: boolean;
  recordatorio_enviado_en: string | null;
}

/**
 * Select base de turnos. `c` es la fila del consultorio (zona y nombre) y `r`
 * el recordatorio enviado para el horario ACTUAL del turno: si se reprogramó,
 * el recordatorio viejo no cuenta.
 */
const SELECT_TURNOS = `
  select t.id, t.paciente_id, p.nombre as paciente_nombre, p.telefono as paciente_telefono,
         t.profesional_id, pr.nombre as profesional_nombre,
         c.nombre as consultorio_nombre,
         to_char(t.inicio at time zone c.zona_horaria, 'YYYY-MM-DD') as fecha,
         to_char(t.inicio at time zone c.zona_horaria, 'HH24:MI') as hora,
         to_char(t.fin at time zone c.zona_horaria, 'HH24:MI') as hora_fin,
         (extract(epoch from t.fin - t.inicio) / 60)::int as duracion_min,
         t.estado, t.nota, t.inicio <= now() as pasado,
         to_char(r.enviado_en at time zone c.zona_horaria, 'YYYY-MM-DD HH24:MI') as recordatorio_enviado_en
  from turnos t
  cross join (
    select nombre, zona_horaria, recordatorio_horas_antes from consultorio where id = 1
  ) c
  join pacientes p on p.id = t.paciente_id
  left join profesionales pr on pr.id = t.profesional_id
  left join recordatorios r on r.turno_id = t.id and r.turno_inicio = t.inicio
`;

function mapearTurno(f: FilaTurno): Turno {
  return {
    id: f.id,
    pacienteId: f.paciente_id,
    pacienteNombre: f.paciente_nombre,
    pacienteTelefono: f.paciente_telefono,
    profesionalId: f.profesional_id,
    profesionalNombre: f.profesional_nombre,
    fecha: f.fecha,
    hora: f.hora,
    horaFin: f.hora_fin,
    duracionMin: f.duracion_min,
    estado: f.estado,
    nota: f.nota,
    pasado: f.pasado,
    recordatorioEnviadoEn: f.recordatorio_enviado_en,
    mensajeRecordatorio: mensajeRecordatorio({
      pacienteNombre: f.paciente_nombre,
      fecha: f.fecha,
      hora: f.hora,
      consultorio: f.consultorio_nombre,
      profesional: f.profesional_nombre,
    }),
  };
}

/**
 * Turnos entre dos fechas locales del consultorio: `desde` incluida, `hasta`
 * excluida ("YYYY-MM-DD"). Opcionalmente, de un solo profesional.
 */
export async function obtenerTurnos({
  desde,
  hasta,
  profesionalId,
}: {
  desde: string;
  hasta: string;
  profesionalId?: string | null;
}): Promise<Turno[]> {
  const filas = await query<FilaTurno>(
    `${SELECT_TURNOS}
     where t.inicio >= ($1::date)::timestamp at time zone c.zona_horaria
       and t.inicio < ($2::date)::timestamp at time zone c.zona_horaria
       and ($3::uuid is null or t.profesional_id = $3::uuid)
     order by t.inicio, pr.nombre nulls first`,
    [desde, hasta, profesionalId ?? null],
  );
  return filas.map(mapearTurno);
}

export async function obtenerTurno(id: string): Promise<Turno | null> {
  const filas = await query<FilaTurno>(`${SELECT_TURNOS} where t.id = $1`, [id]);
  return filas[0] ? mapearTurno(filas[0]) : null;
}

/** Próximos turnos activos a partir de `desde` (fecha local, incluida). */
export async function obtenerProximosTurnos({
  desde,
  limite = 5,
}: {
  desde: string;
  limite?: number;
}): Promise<Turno[]> {
  const filas = await query<FilaTurno>(
    `${SELECT_TURNOS}
     where t.inicio >= ($1::date)::timestamp at time zone c.zona_horaria
       and t.estado in ('pendiente', 'confirmado')
     order by t.inicio
     limit $2`,
    [desde, limite],
  );
  return filas.map(mapearTurno);
}

/**
 * Turnos activos que empiezan dentro de la anticipación configurada y todavía
 * no tienen recordatorio para su horario actual.
 */
export async function obtenerRecordatoriosPendientes(): Promise<Turno[]> {
  const filas = await query<FilaTurno>(
    `${SELECT_TURNOS}
     where t.estado in ('pendiente', 'confirmado')
       and t.inicio > now()
       and t.inicio <= now() + make_interval(hours => c.recordatorio_horas_antes)
       and r.id is null
     order by t.inicio`,
  );
  return filas.map(mapearTurno);
}

// --- Recordatorios enviados -----------------------------------------------

interface FilaRecordatorio {
  id: string;
  turno_id: string;
  paciente_nombre: string;
  fecha_turno: string;
  hora_turno: string;
  canal: CanalRecordatorio;
  enviado_por: string | null;
  enviado_en: string;
  vigente: boolean;
}

export async function obtenerRecordatoriosEnviados(
  limite = 30,
): Promise<RecordatorioEnviado[]> {
  const filas = await query<FilaRecordatorio>(
    `select r.id, r.turno_id, p.nombre as paciente_nombre,
            to_char(r.turno_inicio at time zone c.zona_horaria, 'YYYY-MM-DD') as fecha_turno,
            to_char(r.turno_inicio at time zone c.zona_horaria, 'HH24:MI') as hora_turno,
            r.canal, pe.nombre as enviado_por,
            to_char(r.enviado_en at time zone c.zona_horaria, 'YYYY-MM-DD HH24:MI') as enviado_en,
            r.turno_inicio = t.inicio as vigente
     from recordatorios r
     cross join (select zona_horaria from consultorio where id = 1) c
     join turnos t on t.id = r.turno_id
     join pacientes p on p.id = t.paciente_id
     left join perfiles pe on pe.id = r.enviado_por
     order by r.enviado_en desc
     limit $1`,
    [limite],
  );
  return filas.map((f) => ({
    id: f.id,
    turnoId: f.turno_id,
    pacienteNombre: f.paciente_nombre,
    fechaTurno: f.fecha_turno,
    horaTurno: f.hora_turno,
    canal: f.canal,
    enviadoPor: f.enviado_por,
    enviadoEn: f.enviado_en,
    vigente: f.vigente,
  }));
}
