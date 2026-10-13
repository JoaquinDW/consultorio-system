import "server-only";

import { redirect } from "next/navigation";
import { query } from "./db/pool";
import { obtenerSesion } from "./auth/session";
import type { Rol } from "./types";

export interface UsuarioActual {
  id: string;
  nombre: string;
  rol: Rol;
}

interface FilaPerfil {
  id: string;
  nombre: string;
  rol: Rol;
}

/**
 * Usuario de la sesión actual. Si no hay sesión válida redirige a /login.
 *
 * El proxy corre en el Edge y solo puede ver que la cookie `sid` exista, no que
 * siga siendo válida (no puede tocar Redis). Una cookie vencida —o apuntando a
 * un Redis distinto— pasa el proxy y llega hasta acá: la validación real es
 * esta. Devolver un usuario "Invitado" dejaba la app en un limbo
 * logueado-a-medias, renderizando el shell mientras todas las API routes
 * tiraban 401, sin nada que lo explicara.
 */
export async function usuarioActual(): Promise<UsuarioActual> {
  const userId = await obtenerSesion();
  if (!userId) redirect("/login");

  const filas = await query<FilaPerfil>(
    "select id, nombre, rol from perfiles where id = $1",
    [userId],
  );
  const perfil = filas[0];
  // Sesión viva apuntando a un perfil borrado: tratarla como sesión inválida.
  if (!perfil) redirect("/login");

  return { id: perfil.id, nombre: perfil.nombre, rol: perfil.rol };
}

/**
 * Igual que `usuarioActual`, pero para acciones que solo puede hacer quien
 * administra el consultorio (configuración y profesionales).
 */
export async function esAdministrador(): Promise<boolean> {
  const usuario = await usuarioActual();
  return usuario.rol === "administrador";
}
