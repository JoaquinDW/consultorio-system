"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db/pool";
import { esAdministrador } from "@/lib/auth";
import { esZonaValida } from "@/lib/fechas";
import {
  aTexto,
  mensajeDeError,
  type EstadoFormulario,
} from "@/lib/acciones/estado";

const SIN_PERMISO: EstadoFormulario = {
  ok: false,
  error: "Solo quien administra el consultorio puede cambiar la configuración.",
};

export async function actualizarConsultorio(
  _prev: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  if (!(await esAdministrador())) return SIN_PERMISO;

  const nombre = String(formData.get("nombre") ?? "").trim();
  const zona = String(formData.get("zona_horaria") ?? "");
  const duracion = Number(formData.get("duracion_turno_min"));
  const horas = Number(formData.get("recordatorio_horas_antes"));

  if (!nombre) return { ok: false, error: "Poné el nombre del consultorio." };
  if (!esZonaValida(zona)) return { ok: false, error: "Elegí una zona horaria válida." };
  if (!Number.isInteger(duracion) || duracion < 5 || duracion > 480) {
    return { ok: false, error: "La duración tiene que ser de 5 a 480 minutos." };
  }
  if (!Number.isInteger(horas) || horas < 1 || horas > 168) {
    return { ok: false, error: "La anticipación tiene que ser de 1 a 168 horas." };
  }

  try {
    await query(
      `update consultorio
       set nombre = $1, zona_horaria = $2, duracion_turno_min = $3,
           recordatorio_horas_antes = $4, actualizado_en = now()
       where id = 1`,
      [nombre, zona, duracion, horas],
    );
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error, "No pudimos guardar la configuración.");
  }
}

export async function crearProfesional(
  _prev: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  if (!(await esAdministrador())) return SIN_PERMISO;

  const nombre = String(formData.get("nombre") ?? "").trim();
  if (!nombre) return { ok: false, error: "El nombre es obligatorio." };

  try {
    await query(
      `insert into profesionales (nombre, especialidad) values ($1, $2)`,
      [nombre, aTexto(formData.get("especialidad"))],
    );
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error, "No pudimos agregar el profesional.");
  }
}

/** Desactivar no borra: sus turnos quedan y deja de ofrecerse en el alta. */
export async function cambiarActivoProfesional(
  id: string,
  activo: boolean,
): Promise<EstadoFormulario> {
  if (!(await esAdministrador())) return SIN_PERMISO;
  try {
    await query("update profesionales set activo = $2 where id = $1", [id, activo]);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error, "No pudimos actualizar el profesional.");
  }
}
