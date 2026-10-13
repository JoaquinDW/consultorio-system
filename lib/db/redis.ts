import "server-only";

import { createClient, type RedisClientType } from "redis";

/**
 * Cliente de Redis (sesiones de usuario).
 *
 * Se cachea en globalThis para reutilizar una sola conexión entre recargas
 * del HMR de desarrollo. Node runtime únicamente: no importar en el middleware
 * (corre en Edge).
 */
const globalParaRedis = globalThis as unknown as {
  __consultoriosRedis?: RedisClientType;
};

function crearCliente(): RedisClientType {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error(
      "Falta REDIS_URL. Copiá .env.example a .env.local y levantá Redis con `npm run db:up`.",
    );
  }
  const cliente: RedisClientType = createClient({ url });
  cliente.on("error", (err) => console.error("Redis:", err));
  return cliente;
}

const cliente = globalParaRedis.__consultoriosRedis ?? crearCliente();

if (process.env.NODE_ENV !== "production") {
  globalParaRedis.__consultoriosRedis = cliente;
}

/** Devuelve el cliente de Redis, conectándolo la primera vez que se usa. */
export async function getRedis(): Promise<RedisClientType> {
  if (!cliente.isOpen) {
    await cliente.connect();
  }
  return cliente;
}
