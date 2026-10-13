import { Redis } from "ioredis";

const url = process.env.REDIS_URL;
if (!url) {
  throw new Error("Falta REDIS_URL (la define docker-compose para el servicio bot).");
}

/**
 * Crea una conexión nueva a Redis. BRPOP bloquea la conexión mientras espera,
 * así que cada loop bloqueante (outbox, control) necesita su propio cliente.
 */
export function crearRedis(): Redis {
  const cliente = new Redis(url!, { maxRetriesPerRequest: null });
  cliente.on("error", (err) => console.error("[bot] Redis:", err.message));
  return cliente;
}
