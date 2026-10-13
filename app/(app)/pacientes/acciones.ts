"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db/pool";
import { usuarioActual } from "@/lib/auth";
import {
  aTexto,
  mensajeDeError,
  type EstadoFormulario,
} from "@/lib/acciones/estado";

const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface DatosPaciente {
  nombre: string;
  telefono: string;
  email: string | null;
  nota: string | null;
}

function leerPaciente(
  formData: FormData,
): { datos: DatosPaciente } | { error: string } {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const telefono = String(formData.get("telefono") ?? "").trim();
  const email = aTexto(formData.get("email"));
  const nota = aTexto(formData.get("nota"));

  if (!nombre) return { error: "El nombre es obligatorio." };
  if (telefono.replace(/\D/g, "").length < 6) {
    return { error: "Ingresá un teléfono válido (con característica)." };
  }
  if (email && !RE_EMAIL.test(email)) {
    return { error: "El email no parece válido." };
  }
  if (nota && nota.length > 500) {
    return { error: "La nota puede tener hasta 500 caracteres." };
  }
  return { datos: { nombre, telefono, email, nota } };
}

function revalidar() {
  revalidatePath("/pacientes");
  revalidatePath("/agenda");
  revalidatePath("/inicio");
}

export async function crearPaciente(
  _prev: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await usuarioActual();
  const leido = leerPaciente(formData);
  if ("error" in leido) return { ok: false, error: leido.error };
  const { nombre, telefono, email, nota } = leido.datos;

  try {
    await query(
      `insert into pacientes (nombre, telefono, email, nota) values ($1, $2, $3, $4)`,
      [nombre, telefono, email, nota],
    );
    revalidar();
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error, "No pudimos registrar el paciente.");
  }
}

export async function editarPaciente(
  _prev: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  await usuarioActual();
  const id = String(formData.get("id") ?? "");
  const leido = leerPaciente(formData);
  if ("error" in leido) return { ok: false, error: leido.error };
  const { nombre, telefono, email, nota } = leido.datos;

  try {
    const filas = await query(
      `update pacientes
       set nombre = $2, telefono = $3, email = $4, nota = $5, actualizado_en = now()
       where id = $1
       returning id`,
      [id, nombre, telefono, email, nota],
    );
    if (filas.length === 0) {
      return { ok: false, error: "El paciente ya no existe." };
    }
    revalidar();
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error, "No pudimos guardar los cambios.");
  }
}

/**
 * Archivar no borra: el paciente deja de aparecer en la búsqueda y en el alta
 * de turnos, pero sus turnos y recordatorios quedan. Se puede restaurar.
 */
export async function cambiarArchivoPaciente(
  id: string,
  archivar: boolean,
): Promise<EstadoFormulario> {
  await usuarioActual();
  try {
    await query(
      `update pacientes set archivado = $2, actualizado_en = now() where id = $1`,
      [id, archivar],
    );
    revalidar();
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error, "No pudimos actualizar el paciente.");
  }
}
