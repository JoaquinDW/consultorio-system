import "server-only";

import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { getRedis } from "@/lib/db/redis";
import { COOKIE_SESION } from "./constants";

/** Duración de la sesión: 7 días (en segundos). */
const TTL_SESION = 60 * 60 * 24 * 7;

function claveRedis(token: string): string {
  return `sesion:${token}`;
}

/**
 * Crea una sesión para el usuario: guarda el token en Redis y setea la cookie.
 * Devuelve el token generado.
 */
export async function crearSesion(userId: string): Promise<string> {
  const token = randomUUID();
  const redis = await getRedis();
  await redis.set(claveRedis(token), userId, { EX: TTL_SESION });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_SESION, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL_SESION,
  });

  return token;
}

/** Devuelve el id del usuario de la sesión actual, o null si no hay sesión válida. */
export async function obtenerSesion(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_SESION)?.value;
  if (!token) return null;

  const redis = await getRedis();
  const userId = await redis.get(claveRedis(token));
  return userId ?? null;
}

/** Destruye la sesión actual: borra el token de Redis y limpia la cookie. */
export async function destruirSesion(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_SESION)?.value;
  if (token) {
    const redis = await getRedis();
    await redis.del(claveRedis(token));
  }
  cookieStore.delete(COOKIE_SESION);
}
