import { pool, type WaConversacionFila } from "./db.js";
import { fechaLarga } from "./mensajes.js";

/**
 * Turnos nuevos por WhatsApp: buscar lugar en la agenda y reservar. Solo se usa
 * si en Configuración está prendido "El bot puede dar turnos".
 *
 * Las reglas de horario son las mismas que valida la agenda del panel
 * (`errorDeHorario` en lib/horarios.ts): mantener las dos en sync. Las
 * superposiciones las sigue impidiendo la constraint `turnos_sin_superposicion`.
 */

const ACTOR = "Bot de WhatsApp";
/** No ofrecer turnos que empiecen dentro de este margen. */
const MARGEN_MIN = 60;
const MAX_DIAS = 14;
const MAX_HORAS_POR_DIA = 8;
const MAX_DIAS_CON_LUGAR = 5;

export async function agendarTurnosActivo(): Promise<boolean> {
  try {
    const res = await pool.query<{ activo: boolean }>(
      "select agendar_turnos as activo from public.wa_config where id = 1",
    );
    return res.rows[0]?.activo ?? false;
  } catch (err) {
    console.error("[bot] no se pudo leer si el bot da turnos (queda apagado):", err);
    return false;
  }
}

// --- Datos ---------------------------------------------------------------------

export interface ServicioBot {
  id: string;
  nombre: string;
  duracionMin: number;
  profesionalId: string | null;
  profesional: string | null;
  lugarId: string | null;
  lugar: string | null;
}

/** Servicios activos. Si la tabla no existe todavía, no hay servicios. */
export async function getServicios(): Promise<ServicioBot[]> {
  try {
    const res = await pool.query<ServicioBot>(
      `select s.id, s.nombre, s.duracion_min as "duracionMin",
              s.profesional_id as "profesionalId", pr.nombre as profesional,
              s.lugar_id as "lugarId", l.nombre as lugar
       from public.servicios s
       left join public.profesionales pr on pr.id = s.profesional_id
       left join public.lugares l on l.id = s.lugar_id
       where s.activo
       order by l.nombre nulls first, s.nombre`,
    );
    return res.rows;
  } catch (err) {
    if ((err as { code?: string }).code === "42P01") return [];
    throw err;
  }
}

interface Franja {
  diaSemana: number;
  desde: string;
  hasta: string;
  profesionalId: string | null;
  lugarId: string | null;
}

async function getFranjas(): Promise<Franja[]> {
  try {
    const res = await pool.query<Franja>(
      `select dia_semana as "diaSemana",
              to_char(desde, 'HH24:MI') as desde, to_char(hasta, 'HH24:MI') as hasta,
              profesional_id as "profesionalId", lugar_id as "lugarId"
       from public.horarios`,
    );
    return res.rows;
  } catch (err) {
    if ((err as { code?: string }).code === "42P01") return [];
    throw err;
  }
}

interface Profesional {
  id: string;
  nombre: string;
}

async function getProfesionalesActivos(): Promise<Profesional[]> {
  const res = await pool.query<Profesional>(
    "select id, nombre from public.profesionales where activo order by nombre",
  );
  return res.rows;
}

/** Hoy y la hora actual en la zona del consultorio. */
async function ahoraLocal(): Promise<{ hoy: string; minutos: number }> {
  const res = await pool.query<{ hoy: string; hora: string }>(
    `select to_char(now() at time zone zona_horaria, 'YYYY-MM-DD') as hoy,
            to_char(now() at time zone zona_horaria, 'HH24:MI') as hora
     from public.consultorio where id = 1`,
  );
  return { hoy: res.rows[0].hoy, minutos: aMinutos(res.rows[0].hora) };
}

// --- Reglas de horario (espejo de lib/horarios.ts) -----------------------------

function diaSemana(fecha: string): number {
  const d = new Date(`${fecha}T00:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

function sumarDias(fecha: string, dias: number): string {
  const d = new Date(`${fecha}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function aMinutos(hora: string): number {
  return Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
}

function aHora(minutos: number): string {
  return `${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`;
}

/** Las propias del profesional si tiene; si no, las generales. Null = no hay horarios. */
function franjasQueRigen(franjas: Franja[], profesionalId: string | null): Franja[] | null {
  const propias = profesionalId ? franjas.filter((f) => f.profesionalId === profesionalId) : [];
  if (propias.length > 0) return propias;
  const generales = franjas.filter((f) => f.profesionalId === null);
  return generales.length > 0 ? generales : null;
}

/** Franjas del día donde se puede atender el servicio (por su lugar). */
function franjasUtiles(rigen: Franja[], fecha: string, lugarId: string | null): Franja[] {
  const dia = diaSemana(fecha);
  return rigen
    .filter((f) => f.diaSemana === dia && (!lugarId || !f.lugarId || f.lugarId === lugarId))
    .sort((a, b) => a.desde.localeCompare(b.desde));
}

function entraEnFranja(franjas: Franja[], inicio: number, duracion: number): boolean {
  return franjas.some((f) => aMinutos(f.desde) <= inicio && inicio + duracion <= aMinutos(f.hasta));
}

/** Clave de agenda: los turnos sin profesional comparten una agenda única. */
const agenda = (profesionalId: string | null) => profesionalId ?? "";

interface Ocupado {
  agenda: string;
  fecha: string;
  desde: number;
  hasta: number;
}

async function getOcupados(desde: string, hasta: string): Promise<Ocupado[]> {
  const res = await pool.query<{ agenda: string; fecha: string; hora: string; minutos: string }>(
    `select coalesce(t.profesional_id::text, '') as agenda,
            to_char(t.inicio at time zone c.zona_horaria, 'YYYY-MM-DD') as fecha,
            to_char(t.inicio at time zone c.zona_horaria, 'HH24:MI') as hora,
            extract(epoch from t.fin - t.inicio) / 60 as minutos
     from public.turnos t
     cross join (select zona_horaria from public.consultorio where id = 1) c
     where t.estado in ('pendiente', 'confirmado')
       and t.inicio >= ($1::date at time zone c.zona_horaria)
       and t.inicio < (($2::date + 1) at time zone c.zona_horaria)`,
    [desde, hasta],
  );
  return res.rows.map((f) => {
    const inicio = aMinutos(f.hora);
    return { agenda: f.agenda, fecha: f.fecha, desde: inicio, hasta: inicio + Number(f.minutos) };
  });
}

// --- Disponibilidad --------------------------------------------------------------

interface Pedido {
  servicio: ServicioBot | null;
  duracion: number;
  /** Agendas donde buscar: el profesional del servicio, el pedido, o todos. */
  profesionales: (Profesional | null)[];
}

async function resolverPedido(
  servicioId: string | undefined,
  profesionalId: string | undefined,
): Promise<Pedido | { error: string }> {
  const [servicios, profesionales, consultorio] = await Promise.all([
    getServicios(),
    getProfesionalesActivos(),
    pool.query<{ duracion: number }>(
      "select duracion_turno_min as duracion from public.consultorio where id = 1",
    ),
  ]);

  let servicio: ServicioBot | null = null;
  if (servicioId) {
    servicio = servicios.find((s) => s.id === servicioId) ?? null;
    if (!servicio) return { error: "Ese servicio no existe o no está activo. Usá un id de la lista de servicios." };
  } else if (servicios.length > 0) {
    return { error: "Falta el servicio: preguntale cuál quiere, de la lista de servicios." };
  }

  const fijo = servicio?.profesionalId ?? profesionalId ?? null;
  let candidatos: (Profesional | null)[];
  if (fijo) {
    const p = profesionales.find((x) => x.id === fijo);
    if (!p) return { error: "Ese profesional no existe o no está activo." };
    candidatos = [p];
  } else {
    candidatos = profesionales.length > 0 ? profesionales : [null];
  }

  return {
    servicio,
    duracion: servicio?.duracionMin ?? consultorio.rows[0]?.duracion ?? 30,
    profesionales: candidatos,
  };
}

export interface DiaDisponible {
  fecha: string;
  dia: string;
  profesional: string | null;
  profesional_id: string | null;
  horas: string[];
  hay_mas: boolean;
}

/**
 * Horarios libres desde `desde` (o hoy) durante `dias` días, donde el turno
 * entra completo en el horario de atención y no pisa otro turno.
 */
export async function buscarDisponibilidad({
  servicioId,
  profesionalId,
  desde,
  dias = 7,
}: {
  servicioId?: string;
  profesionalId?: string;
  desde?: string;
  dias?: number;
}): Promise<
  { hoy: string; disponibles: DiaDisponible[]; duracion_min: number } | { error: string }
> {
  const pedido = await resolverPedido(servicioId, profesionalId);
  if ("error" in pedido) return pedido;

  const franjas = await getFranjas();
  if (franjas.length === 0) {
    return { error: "El consultorio no tiene horarios de atención cargados: no se pueden ofrecer turnos. Derivá al equipo." };
  }

  const { hoy, minutos: ahora } = await ahoraLocal();
  if (desde && !/^\d{4}-\d{2}-\d{2}$/.test(desde)) {
    return { error: `\`desde\` tiene que ser YYYY-MM-DD. Hoy es ${hoy}: sacá la fecha del calendario.` };
  }
  if (desde && desde < hoy) {
    return { error: `${desde} ya pasó: hoy es ${hoy}. Sacá la fecha del calendario (revisá el año).` };
  }
  const inicio = desde ?? hoy;
  const cantidad = Math.min(Math.max(Math.trunc(dias) || 7, 1), MAX_DIAS);
  const fin = sumarDias(inicio, cantidad - 1);
  const ocupados = await getOcupados(inicio, fin);
  const paso = pedido.duracion <= 15 ? 15 : 30;

  const disponibles: DiaDisponible[] = [];
  for (let i = 0; i < cantidad; i++) {
    const fecha = sumarDias(inicio, i);
    for (const prof of pedido.profesionales) {
      const rigen = franjasQueRigen(franjas, prof?.id ?? null);
      if (!rigen) continue;
      const delDia = ocupados.filter((o) => o.fecha === fecha && o.agenda === agenda(prof?.id ?? null));
      const horas: string[] = [];
      for (const f of franjasUtiles(rigen, fecha, pedido.servicio?.lugarId ?? null)) {
        for (let m = aMinutos(f.desde); m + pedido.duracion <= aMinutos(f.hasta); m += paso) {
          if (fecha === hoy && m < ahora + MARGEN_MIN) continue;
          if (delDia.some((o) => m < o.hasta && o.desde < m + pedido.duracion)) continue;
          horas.push(aHora(m));
        }
      }
      if (horas.length === 0) continue;
      disponibles.push({
        fecha,
        dia: fechaLarga(fecha),
        profesional: prof?.nombre ?? null,
        profesional_id: prof?.id ?? null,
        horas: horas.slice(0, MAX_HORAS_POR_DIA),
        hay_mas: horas.length > MAX_HORAS_POR_DIA,
      });
    }
    if (new Set(disponibles.map((d) => d.fecha)).size >= MAX_DIAS_CON_LUGAR) break;
  }
  return { hoy, disponibles, duracion_min: pedido.duracion };
}

/**
 * Antes de buscar horarios hace falta el nombre y apellido: el que pasó el LLM
 * o el que ya tiene el paciente vinculado. Devuelve el error, o null.
 */
export async function faltaNombre(
  conversacion: WaConversacionFila,
  nombreCompleto: string | undefined,
): Promise<string | null> {
  if (palabras(limpiarNombre(nombreCompleto ?? "")) >= 2) return null;
  const res = await pool.query<{ nombre: string }>(
    `select p.nombre from public.wa_conversaciones c
     join public.pacientes p on p.id = c.paciente_id
     where c.id = $1`,
    [conversacion.id],
  );
  const registrado = res.rows[0]?.nombre;
  if (registrado && palabras(registrado) >= 2) return null;
  return "Todavía no tenés el nombre y apellido: pedíselo antes de buscar horarios.";
}

// --- Reserva ---------------------------------------------------------------------

export interface TurnoAgendado {
  fecha: string;
  dia: string;
  hora: string;
  servicio: string | null;
  profesional: string | null;
  paciente: string;
}

function limpiarNombre(nombre: string): string {
  return nombre.trim().replace(/\s+/g, " ").slice(0, 120);
}

const palabras = (nombre: string) => nombre.split(" ").filter(Boolean).length;

/**
 * Reserva el turno (estado pendiente) a nombre de quien escribe. Si no es
 * paciente, lo da de alta con su teléfono; si lo es pero solo tenemos el nombre
 * de pila, completa el apellido. No agenda si ya tiene un turno próximo: eso
 * lo maneja el equipo.
 */
export async function agendarTurno(
  conversacion: WaConversacionFila,
  args: {
    nombreCompleto?: string;
    servicioId?: string;
    profesionalId?: string;
    fecha?: string;
    hora?: string;
  },
): Promise<{ ok: true; turno: TurnoAgendado } | { ok: false; error: string }> {
  const fecha = args.fecha ?? "";
  const hora = args.hora ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(hora)) {
    return { ok: false, error: "Fecha u hora inválida: usá YYYY-MM-DD y HH:MM." };
  }

  const pedido = await resolverPedido(args.servicioId, args.profesionalId);
  if ("error" in pedido) return { ok: false, error: pedido.error };
  if (pedido.profesionales.length > 1) {
    return { ok: false, error: "Falta el profesional: usá el profesional_id del horario que eligió." };
  }
  const prof = pedido.profesionales[0];

  // Mismo criterio que la disponibilidad ofrecida.
  const { hoy, minutos: ahora } = await ahoraLocal();
  const inicio = aMinutos(hora);
  if (fecha < hoy) {
    return {
      ok: false,
      error: `La fecha ${fecha} ya pasó: hoy es ${hoy}. Seguramente le erraste al año o al día; sacá la fecha del calendario y reintentá.`,
    };
  }
  if (fecha === hoy && inicio < ahora + MARGEN_MIN) {
    return { ok: false, error: "Ese horario de hoy ya pasó o es demasiado pronto. Ofrecé otro." };
  }
  const rigen = franjasQueRigen(await getFranjas(), prof?.id ?? null);
  if (!rigen) {
    return { ok: false, error: "El consultorio no tiene horarios de atención cargados. Derivá al equipo." };
  }
  if (!entraEnFranja(franjasUtiles(rigen, fecha, pedido.servicio?.lugarId ?? null), inicio, pedido.duracion)) {
    return { ok: false, error: "Ese horario está fuera del horario de atención. Consultá la disponibilidad y ofrecé otro." };
  }

  const nombreNuevo = limpiarNombre(args.nombreCompleto ?? "");
  const telefonoDesconocido =
    conversacion.jid?.endsWith("@lid") && conversacion.jid.split("@")[0] === conversacion.telefono;

  const cliente = await pool.connect();
  try {
    await cliente.query("begin");

    // Paciente: el vinculado a la conversación, uno con el mismo teléfono, o nuevo.
    const conv = await cliente.query<{ paciente_id: string | null }>(
      "select paciente_id from public.wa_conversaciones where id = $1 for update",
      [conversacion.id],
    );
    let pacienteId = conv.rows[0]?.paciente_id ?? null;
    if (!pacienteId && !telefonoDesconocido) {
      const existente = await cliente.query<{ id: string }>(
        `select id from public.pacientes
         where not archivado
           and right(regexp_replace(telefono, '\\D', '', 'g'), 10) = right($1, 10)
         order by creado_en desc limit 1`,
        [conversacion.telefono.replace(/\D/g, "")],
      );
      pacienteId = existente.rows[0]?.id ?? null;
    }

    let nombrePaciente: string;
    if (pacienteId) {
      const p = await cliente.query<{ nombre: string }>(
        "select nombre from public.pacientes where id = $1",
        [pacienteId],
      );
      nombrePaciente = p.rows[0]?.nombre ?? nombreNuevo;
      if (palabras(nombrePaciente) < 2) {
        if (palabras(nombreNuevo) < 2) {
          await cliente.query("rollback");
          return { ok: false, error: "Falta el apellido: pedile nombre y apellido antes de agendar." };
        }
        await cliente.query(
          "update public.pacientes set nombre = $2, actualizado_en = now() where id = $1",
          [pacienteId, nombreNuevo],
        );
        nombrePaciente = nombreNuevo;
      }
      const proximos = await cliente.query(
        `select 1 from public.turnos
         where paciente_id = $1 and estado in ('pendiente', 'confirmado') and inicio > now()
         limit 1`,
        [pacienteId],
      );
      if (proximos.rowCount) {
        await cliente.query("rollback");
        return { ok: false, error: "Ya tiene un turno próximo: no agendes otro, derivá al equipo." };
      }
    } else {
      if (telefonoDesconocido) {
        await cliente.query("rollback");
        return { ok: false, error: "No tenemos el número de quien escribe, no se puede dar de alta. Derivá al equipo." };
      }
      if (palabras(nombreNuevo) < 2) {
        await cliente.query("rollback");
        return { ok: false, error: "Falta el nombre completo: pedile nombre y apellido antes de agendar." };
      }
      const nuevo = await cliente.query<{ id: string }>(
        "insert into public.pacientes (nombre, telefono) values ($1, $2) returning id",
        [nombreNuevo, `+${conversacion.telefono}`],
      );
      pacienteId = nuevo.rows[0].id;
      nombrePaciente = nombreNuevo;
    }
    await cliente.query("update public.wa_conversaciones set paciente_id = $2 where id = $1", [
      conversacion.id,
      pacienteId,
    ]);

    const turno = await cliente.query<{ id: string }>(
      `insert into public.turnos (paciente_id, profesional_id, servicio_id, inicio, fin)
       select $1, $2, $3, i.inicio, i.inicio + make_interval(mins => $6)
       from (select ($4::date + $5::time) at time zone zona_horaria as inicio
             from public.consultorio where id = 1) i
       returning id`,
      [pacienteId, prof?.id ?? null, pedido.servicio?.id ?? null, fecha, hora, pedido.duracion],
    );
    await cliente.query(
      `insert into public.eventos_turno (turno_id, tipo, descripcion, actor)
       values ($1, 'creado', $2, $3)`,
      [turno.rows[0].id, `Turno agendado por WhatsApp para el ${fecha} a las ${hora}`, ACTOR],
    );
    await cliente.query("commit");

    return {
      ok: true,
      turno: {
        fecha,
        dia: fechaLarga(fecha),
        hora,
        servicio: pedido.servicio?.nombre ?? null,
        profesional: prof?.nombre ?? null,
        paciente: nombrePaciente,
      },
    };
  } catch (err) {
    await cliente.query("rollback");
    if ((err as { code?: string }).code === "23P01") {
      return { ok: false, error: "Ese horario se acaba de ocupar. Consultá la disponibilidad de nuevo y ofrecé otro." };
    }
    throw err;
  } finally {
    cliente.release();
  }
}
