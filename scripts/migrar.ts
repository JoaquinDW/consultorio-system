/**
 * Aplica las migraciones a una base que ya existe.
 *
 * Uso: `npm run db:migrate` (requiere la base levantada con `npm run db:up`).
 *
 * Postgres corre db/migrations/ solo al primer init (base vacía). Las
 * migraciones posteriores al esquema inicial son idempotentes, así que acá se
 * corren todas de nuevo en orden; el esquema inicial se saltea si la base ya
 * lo tiene.
 */
import { readdirSync, readFileSync } from "node:fs";
import { Client } from "pg";

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

const ESQUEMA_INICIAL = "20261012000001_esquema_inicial.sql";
const CARPETA = new URL("../db/migrations/", import.meta.url);

async function main() {
  const db = new Client({ connectionString: DATABASE_URL });
  await db.connect();
  console.log(`→ Conectado a ${DATABASE_URL.replace(/:\/\/[^@]+@/, "://***@")}`);

  try {
    const archivos = readdirSync(CARPETA)
      .filter((a) => a.endsWith(".sql"))
      .sort();
    const { rows } = await db.query<{ existe: boolean }>(
      "select to_regclass('public.consultorio') is not null as existe",
    );
    for (const archivo of archivos) {
      if (archivo === ESQUEMA_INICIAL && rows[0].existe) {
        console.log(`  · ${archivo} (ya aplicado)`);
        continue;
      }
      await db.query("begin");
      await db.query(readFileSync(new URL(archivo, CARPETA), "utf8"));
      await db.query("commit");
      console.log(`  ✓ ${archivo}`);
    }
    console.log("✓ Base al día.");
  } catch (error) {
    await db.query("rollback").catch(() => {});
    throw error;
  } finally {
    await db.end();
  }
}

main().catch((error) => {
  console.error("✗ Falló la migración:", error);
  process.exit(1);
});
