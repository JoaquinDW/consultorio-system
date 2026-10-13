/**
 * Seed de la demo de Turnos (consultorios).
 *
 * Uso: `npm run db:seed` (requiere la base levantada con `npm run db:up`).
 *
 * - Todos los datos son ficticios: nombres inventados y teléfonos 555-01xx.
 *   No se cargan datos clínicos.
 * - Los turnos se generan relativos a HOY (en la zona del consultorio), así la
 *   demo siempre muestra agenda del día y de la semana.
 * - Es idempotente: TRUNCATE ... CASCADE al inicio.
 */
import { readFileSync } from "node:fs";
import { Client } from "pg";
import argon2 from "argon2";

// tsx no carga .env.local automáticamente; lo leemos a mano si existe.
function cargarEnvLocal() {
  try {
    const contenido = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
    for (const linea of contenido.split("\n")) {
      const limpia = linea.trim();
      if (!limpia || limpia.startsWith("#")) continue;
      const i = limpia.indexOf("=");
      if (i === -1) continue;
      const clave = limpia.slice(0, i).trim();
      const valor = limpia.slice(i + 1).trim();
      if (!(clave in process.env)) process.env[clave] = valor;
    }
  } catch {
    // Sin .env.local usamos los valores por defecto de docker-compose.
  }
}
cargarEnvLocal();

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgres://consultorio:consultorio@localhost:5433/consultorios";

const PASSWORD_DEMO = "turnos2026";

const USUARIOS = [
  { email: "admin@consultorio.demo", nombre: "Carla Gómez", rol: "administrador" },
  { email: "recepcion@consultorio.demo", nombre: "Martín Ruiz", rol: "recepcion" },
];

const PROFESIONALES = [
  { nombre: "Dra. Laura Méndez", especialidad: "Odontología" },
  { nombre: "Lic. Pablo Ferreyra", especialidad: "Kinesiología" },
];

const PACIENTES = [
  { nombre: "Ana Belén Torres", nota: "Prefiere turnos por la tarde." },
  { nombre: "Bruno Castillo", nota: null },
  { nombre: "Camila Herrera", nota: "Avisar por WhatsApp, no llamar." },
  { nombre: "Diego Paz", nota: null },
  { nombre: "Elena Suárez", nota: "Viene con su hija." },
  { nombre: "Facundo Ríos", nota: null },
  { nombre: "Gabriela Ortiz", nota: null },
  { nombre: "Hernán Molina", nota: "Llega en silla de ruedas: dejar el acceso libre." },
  { nombre: "Inés Villalba", nota: null },
  { nombre: "Julián Acosta", nota: null },
  { nombre: "Lucía Benítez", nota: null },
  { nombre: "Mateo Sosa", nota: null },
];

// [día relativo a hoy, hora, duración, índice de paciente, índice de profesional, estado]
type Estado = "pendiente" | "confirmado" | "cancelado" | "realizado";
const TURNOS: [number, string, number, number, number, Estado][] = [
  [-2, "10:00", 30, 6, 0, "realizado"],
  [-1, "11:30", 45, 7, 1, "realizado"],
  [-1, "16:00", 30, 8, 0, "cancelado"],
  [0, "09:00", 30, 0, 0, "realizado"],
  [0, "10:00", 30, 1, 0, "confirmado"],
  [0, "11:00", 45, 2, 1, "pendiente"],
  [0, "15:30", 30, 3, 0, "pendiente"],
  [0, "17:00", 60, 4, 1, "confirmado"],
  [1, "09:30", 30, 5, 0, "pendiente"],
  [1, "10:00", 45, 9, 1, "confirmado"],
  [1, "12:00", 30, 10, 0, "pendiente"],
  [2, "14:00", 30, 11, 0, "pendiente"],
  [3, "09:00", 45, 6, 1, "pendiente"],
  [4, "16:30", 30, 2, 0, "pendiente"],
  [6, "10:30", 30, 1, 1, "pendiente"],
  [8, "11:00", 30, 0, 0, "pendiente"],
];

async function main() {
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  console.log(`→ Conectado a ${DATABASE_URL.replace(/:\/\/[^@]+@/, "://***@")}`);

  try {
    await db.query("begin");
    await db.query(
      "truncate recordatorios, eventos_turno, turnos, pacientes, profesionales, perfiles cascade",
    );
    await db.query(
      `update consultorio
       set nombre = 'Consultorio Demo', zona_horaria = 'America/Argentina/Buenos_Aires',
           duracion_turno_min = 30, recordatorio_horas_antes = 24
       where id = 1`,
    );

    const hash = await argon2.hash(PASSWORD_DEMO);
    const idsUsuarios: string[] = [];
    for (const u of USUARIOS) {
      const { rows } = await db.query<{ id: string }>(
        `insert into perfiles (email, password_hash, nombre, rol) values ($1, $2, $3, $4) returning id`,
        [u.email, hash, u.nombre, u.rol],
      );
      idsUsuarios.push(rows[0].id);
    }

    const idsProfesionales: string[] = [];
    for (const p of PROFESIONALES) {
      const { rows } = await db.query<{ id: string }>(
        `insert into profesionales (nombre, especialidad) values ($1, $2) returning id`,
        [p.nombre, p.especialidad],
      );
      idsProfesionales.push(rows[0].id);
    }

    const idsPacientes: string[] = [];
    for (const [i, p] of PACIENTES.entries()) {
      const sufijo = String(i + 1).padStart(2, "0");
      const { rows } = await db.query<{ id: string }>(
        `insert into pacientes (nombre, telefono, email, nota) values ($1, $2, $3, $4) returning id`,
        [
          p.nombre,
          `+54 9 351 555-01${sufijo}`,
          i % 3 === 0 ? `paciente${sufijo}@ejemplo.com` : null,
          p.nota,
        ],
      );
      idsPacientes.push(rows[0].id);
    }
    // Un paciente archivado, para mostrar el filtro.
    await db.query(
      `insert into pacientes (nombre, telefono, archivado) values ('Rodrigo Funes', '+54 9 351 555-0199', true)`,
    );

    for (const [dia, hora, duracion, iPac, iProf, estado] of TURNOS) {
      const { rows } = await db.query<{ id: string }>(
        `with c as (select zona_horaria from consultorio where id = 1),
              i as (
                select ((((now() at time zone c.zona_horaria)::date + $1::int) + $2::time)
                        at time zone c.zona_horaria) as inicio
                from c
              )
         insert into turnos (paciente_id, profesional_id, inicio, fin, estado)
         select $3, $4, i.inicio, i.inicio + make_interval(mins => $5), $6::estado_turno from i
         returning id`,
        [dia, hora, idsPacientes[iPac], idsProfesionales[iProf], duracion, estado],
      );
      await db.query(
        `insert into eventos_turno (turno_id, tipo, descripcion, actor) values ($1, 'creado', 'Turno agendado (seed)', 'Seed')`,
        [rows[0].id],
      );
    }

    // Un recordatorio ya enviado: el turno confirmado de hoy a las 17.
    await db.query(
      `insert into recordatorios (turno_id, turno_inicio, canal, mensaje, enviado_por, enviado_en)
       select t.id, t.inicio, 'whatsapp_manual', 'Recordatorio de ejemplo (seed)', $1, now() - interval '20 hours'
       from turnos t
       where t.paciente_id = $2 and t.estado = 'confirmado'`,
      [idsUsuarios[1], idsPacientes[4]],
    );

    await db.query("commit");
    console.log("✓ Seed completo.");
    console.log(`  Administrador: ${USUARIOS[0].email}`);
    console.log(`  Recepción:     ${USUARIOS[1].email}`);
    console.log(`  Contraseña de demo (ambos): ${PASSWORD_DEMO}`);
  } catch (error) {
    await db.query("rollback");
    throw error;
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("✗ Falló el seed:", error);
  process.exit(1);
});
