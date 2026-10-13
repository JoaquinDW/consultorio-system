import "server-only";

import argon2 from "argon2";

/** Hashea una contraseña para guardarla en perfiles.password_hash. */
export function hashPassword(plano: string): Promise<string> {
  return argon2.hash(plano);
}

/** Verifica una contraseña contra el hash guardado. */
export async function verifyPassword(
  hash: string,
  plano: string,
): Promise<boolean> {
  try {
    return await argon2.verify(hash, plano);
  } catch {
    return false;
  }
}
