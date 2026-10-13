"use server";

import { redirect } from "next/navigation";
import { query } from "@/lib/db/pool";
import { verifyPassword } from "./password";
import { crearSesion, destruirSesion } from "./session";

export interface EstadoLogin {
  error?: string;
}

interface FilaCredenciales {
  id: string;
  password_hash: string;
  activo: boolean;
}

/**
 * Server Action de login (usada con useActionState en app/login/page.tsx).
 * Verifica email + contraseña contra perfiles y crea la sesión en Redis.
 */
export async function iniciarSesion(
  _prev: EstadoLogin,
  formData: FormData,
): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Ingresá tu email y contraseña." };
  }

  const filas = await query<FilaCredenciales>(
    "select id, password_hash, activo from perfiles where lower(email) = $1",
    [email],
  );
  const perfil = filas[0];

  if (!perfil || !(await verifyPassword(perfil.password_hash, password))) {
    return {
      error:
        "No pudimos iniciar tu sesión. Revisá el email y la contraseña e intentá de nuevo.",
    };
  }

  if (!perfil.activo) {
    return {
      error: "Tu acceso fue desactivado. Consultá con quien administra el consultorio.",
    };
  }

  await crearSesion(perfil.id);
  redirect("/inicio");
}

/** Server Action de logout: destruye la sesión y vuelve al login. */
export async function cerrarSesion(): Promise<void> {
  await destruirSesion();
  redirect("/login");
}
