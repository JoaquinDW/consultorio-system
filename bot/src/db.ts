import { readFile } from "node:fs/promises";
import pg from "pg";

const { Pool, types } = pg;

// Fechas como strings crudos, igual que la capa de datos del panel
// (lib/db/pool.ts): date, timestamp y timestamptz.
types.setTypeParser(1082, (v) => v);
types.setTypeParser(1114, (v) => v);
types.setTypeParser(1184, (v) => v);

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("Falta DATABASE_URL (la define docker-compose para el servicio bot).");
}

export const pool = new Pool({ connectionString });

export type ModoWa = "ia" | "humano";
export type RolWaMensaje = "cliente" | "ia" | "humano" | "sistema";
export type EstadoConexionWa = "desconectado" | "qr" | "conectando" | "conectado";

export interface WaConversacionFila {
  id: string;
  telefono: string;
  jid: string | null;
  nombre: string | null;
  modo: ModoWa;
  paciente_id: string | null;
  requiere_atencion: boolean;
  ultimo_mensaje_en: string | null;
  creado_en: string;
}

export interface WaEstadoConexionFila {
  estado: EstadoConexionWa;
  qr_string: string | null;
  telefono: string | null;
  actualizado_en: string;
}

export interface MensajeHistorial {
  rol: RolWaMensaje;
  contenido: string;
}

// El DDL del módulo es la misma migración que corre Postgres al primer init
// (db/migrations/20261013000001_whatsapp.sql, idempotente). Se vuelve a correr
// en cada arranque para las bases creadas antes de que existiera el bot. En
// Docker la carpeta se monta en /db/migrations (ver docker-compose.yml).
const RUTA_DDL = new URL(
  "../../db/migrations/20261013000001_whatsapp.sql",
  import.meta.url,
);

/** Crea/actualiza las tablas wa_* si hace falta. Se corre en cada arranque. */
export async function ensureSchema(): Promise<void> {
  const ddl = await readFile(RUTA_DDL, "utf8");
  await pool.query(ddl);
  console.log("[bot] schema wa_* verificado");
}

// --- Conexión ----------------------------------------------------------------

export async function getEstadoConexion(): Promise<WaEstadoConexionFila> {
  const res = await pool.query<WaEstadoConexionFila>(
    "select estado, qr_string, telefono, actualizado_en from public.wa_estado_conexion where id = 1",
  );
  return res.rows[0];
}

/**
 * Actualiza el estado de conexión preservando los campos que no se pasan:
 * `undefined` = dejar como está, `null` = borrar. Esto evita perder el
 * qr_string en transiciones como 'qr' → 'conectando'.
 */
export async function setEstadoConexion(patch: {
  estado?: EstadoConexionWa;
  qr_string?: string | null;
  telefono?: string | null;
}): Promise<void> {
  const sets: string[] = ["actualizado_en = now()"];
  const valores: unknown[] = [];
  if (patch.estado !== undefined) {
    valores.push(patch.estado);
    sets.push(`estado = $${valores.length}`);
  }
  if (patch.qr_string !== undefined) {
    valores.push(patch.qr_string);
    sets.push(`qr_string = $${valores.length}`);
  }
  if (patch.telefono !== undefined) {
    valores.push(patch.telefono);
    sets.push(`telefono = $${valores.length}`);
  }
  await pool.query(`update public.wa_estado_conexion set ${sets.join(", ")} where id = 1`, valores);
}

// --- Conversaciones ----------------------------------------------------------

export async function getOrCreateConversacion(
  telefono: string,
  jid: string | null,
  nombre?: string,
): Promise<WaConversacionFila> {
  const res = await pool.query<WaConversacionFila>(
    `insert into public.wa_conversaciones (telefono, jid, nombre) values ($1, $2, $3)
     on conflict (telefono) do update
       set nombre = coalesce(excluded.nombre, wa_conversaciones.nombre),
           jid = coalesce(excluded.jid, wa_conversaciones.jid)
     returning *`,
    [telefono, jid, nombre ?? null],
  );
  return res.rows[0];
}

/** jid del chat para responder. Null si nunca escribió (se arma con el número). */
export async function getJidPorTelefono(telefono: string): Promise<string | null> {
  const res = await pool.query<{ jid: string | null }>(
    "select jid from public.wa_conversaciones where telefono = $1",
    [telefono],
  );
  return res.rows[0]?.jid ?? null;
}

/** Re-lectura fresca del modo: el toggle del panel pudo cambiar entre medio. */
export async function getModo(conversacionId: string): Promise<ModoWa | null> {
  const res = await pool.query<{ modo: ModoWa }>(
    "select modo from public.wa_conversaciones where id = $1",
    [conversacionId],
  );
  return res.rows[0]?.modo ?? null;
}

export async function insertarMensaje(
  conversacionId: string,
  rol: RolWaMensaje,
  contenido: string,
): Promise<void> {
  const cliente = await pool.connect();
  try {
    await cliente.query("begin");
    await cliente.query(
      "insert into public.wa_mensajes (conversacion_id, rol, contenido) values ($1, $2, $3)",
      [conversacionId, rol, contenido],
    );
    await cliente.query(
      "update public.wa_conversaciones set ultimo_mensaje_en = now() where id = $1",
      [conversacionId],
    );
    await cliente.query("commit");
  } catch (err) {
    await cliente.query("rollback");
    throw err;
  } finally {
    cliente.release();
  }
}

/** Últimos N mensajes en orden cronológico ascendente (DESC + reverse). */
export async function getHistorialReciente(
  conversacionId: string,
  limite = 20,
): Promise<MensajeHistorial[]> {
  const res = await pool.query<MensajeHistorial>(
    `select rol, contenido from public.wa_mensajes
     where conversacion_id = $1
     order by creado_en desc, id desc
     limit $2`,
    [conversacionId, limite],
  );
  return res.rows.reverse();
}

/**
 * Último mensaje que salió del lado del consultorio (no del paciente), con
 * cuántas horas pasaron. Sirve para saber si el paciente está contestando un
 * recordatorio.
 */
export async function getUltimoMensajeNuestro(
  conversacionId: string,
): Promise<{ rol: RolWaMensaje; horas: number } | null> {
  const res = await pool.query<{ rol: RolWaMensaje; horas: string }>(
    `select rol, extract(epoch from now() - creado_en) / 3600 as horas
     from public.wa_mensajes
     where conversacion_id = $1 and rol <> 'cliente'
     order by creado_en desc, id desc
     limit 1`,
    [conversacionId],
  );
  const f = res.rows[0];
  return f ? { rol: f.rol, horas: Number(f.horas) } : null;
}

/** El paciente pidió algo que tiene que ver una persona: pasa a modo humano. */
export async function marcarAtencion(conversacionId: string): Promise<void> {
  await pool.query(
    `update public.wa_conversaciones set requiere_atencion = true, modo = 'humano' where id = $1`,
    [conversacionId],
  );
}

// --- Pacientes y turnos --------------------------------------------------------

/**
 * Vincula la conversación con el paciente del mismo teléfono (comparando los
 * últimos 10 dígitos: "+54 9 351 555-0101" ↔ "5493515550101"). Si ya estaba
 * vinculada no la toca: lo que se haya elegido en el panel manda.
 */
export async function vincularPaciente(
  conversacion: WaConversacionFila,
): Promise<string | null> {
  if (conversacion.paciente_id) return conversacion.paciente_id;
  const digitos = conversacion.telefono.replace(/\D/g, "");
  if (digitos.length < 8) return null;
  const res = await pool.query<{ id: string }>(
    `update public.wa_conversaciones c
     set paciente_id = (
       select p.id from public.pacientes p
       where not p.archivado
         and right(regexp_replace(p.telefono, '\\D', '', 'g'), 10) = right($2, 10)
       order by p.creado_en desc
       limit 1
     )
     where c.id = $1
     returning c.paciente_id as id`,
    [conversacion.id, digitos],
  );
  return res.rows[0]?.id ?? null;
}

export interface Consultorio {
  nombre: string;
  zonaHoraria: string;
  profesionales: { id: string; nombre: string; especialidad: string | null }[];
}

export async function getConsultorio(): Promise<Consultorio> {
  const [c, p] = await Promise.all([
    pool.query<{ nombre: string; zona_horaria: string }>(
      "select nombre, zona_horaria from public.consultorio where id = 1",
    ),
    pool.query<{ id: string; nombre: string; especialidad: string | null }>(
      "select id, nombre, especialidad from public.profesionales where activo order by nombre",
    ),
  ]);
  return {
    nombre: c.rows[0]?.nombre ?? "el consultorio",
    zonaHoraria: c.rows[0]?.zona_horaria ?? "America/Argentina/Buenos_Aires",
    profesionales: p.rows,
  };
}

export interface TurnoPaciente {
  id: string;
  fecha: string;
  hora: string;
  estado: "pendiente" | "confirmado";
  profesional: string | null;
}

export interface ContextoPaciente {
  nombre: string;
  proximosTurnos: TurnoPaciente[];
}

/** Nombre del paciente y sus turnos activos a futuro, en la zona del consultorio. */
export async function getContextoPaciente(pacienteId: string): Promise<ContextoPaciente | null> {
  const [p, t] = await Promise.all([
    pool.query<{ nombre: string }>("select nombre from public.pacientes where id = $1", [
      pacienteId,
    ]),
    pool.query<TurnoPaciente>(
      `select t.id,
              to_char(t.inicio at time zone c.zona_horaria, 'YYYY-MM-DD') as fecha,
              to_char(t.inicio at time zone c.zona_horaria, 'HH24:MI') as hora,
              t.estado::text as estado,
              pr.nombre as profesional
       from public.turnos t
       cross join (select zona_horaria from public.consultorio where id = 1) c
       left join public.profesionales pr on pr.id = t.profesional_id
       where t.paciente_id = $1
         and t.estado in ('pendiente', 'confirmado')
         and t.inicio > now()
       order by t.inicio
       limit 5`,
      [pacienteId],
    ),
  ]);
  if (!p.rows[0]) return null;
  return { nombre: p.rows[0].nombre, proximosTurnos: t.rows };
}

/**
 * Confirma un turno pendiente del paciente y deja el evento en su historial.
 * Devuelve false si el turno ya no estaba pendiente.
 */
export async function confirmarTurno(turnoId: string): Promise<boolean> {
  const cliente = await pool.connect();
  try {
    await cliente.query("begin");
    const res = await cliente.query(
      `update public.turnos set estado = 'confirmado', actualizado_en = now()
       where id = $1 and estado = 'pendiente' returning id`,
      [turnoId],
    );
    if (res.rowCount) {
      await cliente.query(
        `insert into public.eventos_turno (turno_id, tipo, descripcion, actor)
         values ($1, 'whatsapp', 'El paciente confirmó por WhatsApp', 'Bot de WhatsApp')`,
        [turnoId],
      );
    }
    await cliente.query("commit");
    return Boolean(res.rowCount);
  } catch (err) {
    await cliente.query("rollback");
    throw err;
  } finally {
    cliente.release();
  }
}

export async function registrarEventoTurno(turnoId: string, descripcion: string): Promise<void> {
  await pool.query(
    `insert into public.eventos_turno (turno_id, tipo, descripcion, actor)
     values ($1, 'whatsapp', $2, 'Bot de WhatsApp')`,
    [turnoId, descripcion],
  );
}

// --- Recordatorios automáticos ------------------------------------------------

export async function recordatoriosAutomaticosActivos(): Promise<boolean> {
  const res = await pool.query<{ activo: boolean }>(
    "select recordatorios_automaticos as activo from public.wa_config where id = 1",
  );
  return res.rows[0]?.activo ?? false;
}

export interface TurnoParaRecordar {
  turno_id: string;
  turno_inicio: string;
  paciente_id: string;
  paciente_nombre: string;
  telefono: string;
  fecha: string;
  hora: string;
  profesional: string | null;
  consultorio: string;
}

/**
 * Misma regla que la lista "Para enviar" del panel
 * (obtenerRecordatoriosPendientes en lib/data.ts): turnos activos dentro de la
 * anticipación configurada y sin recordatorio para su horario actual.
 */
export async function getTurnosParaRecordar(): Promise<TurnoParaRecordar[]> {
  const res = await pool.query<TurnoParaRecordar>(
    `select t.id as turno_id, t.inicio::text as turno_inicio,
            p.id as paciente_id, p.nombre as paciente_nombre, p.telefono,
            to_char(t.inicio at time zone c.zona_horaria, 'YYYY-MM-DD') as fecha,
            to_char(t.inicio at time zone c.zona_horaria, 'HH24:MI') as hora,
            pr.nombre as profesional, c.nombre as consultorio
     from public.turnos t
     cross join (
       select nombre, zona_horaria, recordatorio_horas_antes from public.consultorio where id = 1
     ) c
     join public.pacientes p on p.id = t.paciente_id
     left join public.profesionales pr on pr.id = t.profesional_id
     left join public.recordatorios r on r.turno_id = t.id and r.turno_inicio = t.inicio
     where t.estado in ('pendiente', 'confirmado')
       and t.inicio > now()
       and t.inicio <= now() + make_interval(hours => c.recordatorio_horas_antes)
       and r.id is null
     order by t.inicio
     limit 20`,
  );
  return res.rows;
}

/**
 * Reserva el recordatorio antes de mandarlo: el unique (turno_id, turno_inicio)
 * garantiza que no salga dos veces aunque el panel lo mande a la vez. Devuelve
 * el id, o null si ya existía.
 */
export async function reclamarRecordatorio(
  turno: TurnoParaRecordar,
  mensaje: string,
): Promise<string | null> {
  const res = await pool.query<{ id: string }>(
    `insert into public.recordatorios (turno_id, turno_inicio, canal, mensaje)
     values ($1, $2::timestamptz, 'whatsapp_bot', $3)
     on conflict (turno_id, turno_inicio) do nothing
     returning id`,
    [turno.turno_id, turno.turno_inicio, mensaje],
  );
  return res.rows[0]?.id ?? null;
}

/** Si el envío falló, se libera la reserva para reintentar en la próxima vuelta. */
export async function liberarRecordatorio(id: string): Promise<void> {
  await pool.query("delete from public.recordatorios where id = $1", [id]);
}

export async function vincularConversacionAPaciente(
  conversacionId: string,
  pacienteId: string,
): Promise<void> {
  await pool.query(
    "update public.wa_conversaciones set paciente_id = coalesce(paciente_id, $2) where id = $1",
    [conversacionId, pacienteId],
  );
}

export async function cerrarPool(): Promise<void> {
  await pool.end();
}
