"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db/pool";
import { esAdministrador } from "@/lib/auth";
import { esHoraValida, esZonaValida } from "@/lib/fechas";
import { SIN_LUGAR, SIN_PROFESIONAL } from "@/lib/labels";
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

export async function crearLugar(
  _prev: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  if (!(await esAdministrador())) return SIN_PERMISO;

  const nombre = String(formData.get("nombre") ?? "").trim();
  const direccion = aTexto(formData.get("direccion"));
  if (!nombre) return { ok: false, error: "El nombre es obligatorio." };
  if (nombre.length > 120) return { ok: false, error: "El nombre puede tener hasta 120 caracteres." };
  if (direccion && direccion.length > 200) {
    return { ok: false, error: "La dirección puede tener hasta 200 caracteres." };
  }

  try {
    await query(`insert into lugares (nombre, direccion) values ($1, $2)`, [nombre, direccion]);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error, "No pudimos agregar el lugar.");
  }
}

/** Desactivar no borra: sus servicios quedan, pero deja de ofrecerse al cargar uno nuevo. */
export async function cambiarActivoLugar(
  id: string,
  activo: boolean,
): Promise<EstadoFormulario> {
  if (!(await esAdministrador())) return SIN_PERMISO;
  try {
    await query("update lugares set activo = $2 where id = $1", [id, activo]);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error, "No pudimos actualizar el lugar.");
  }
}

/** Agrega la misma franja (desde–hasta) a cada día marcado. */
export async function crearHorarios(
  _prev: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  if (!(await esAdministrador())) return SIN_PERMISO;

  const dias = [...new Set(formData.getAll("dias").map(Number))].filter(
    (d) => Number.isInteger(d) && d >= 1 && d <= 7,
  );
  const desde = String(formData.get("desde") ?? "");
  const hasta = String(formData.get("hasta") ?? "");
  const profesional = aTexto(formData.get("profesional_id"));
  const lugar = aTexto(formData.get("lugar_id"));

  if (dias.length === 0) return { ok: false, error: "Marcá al menos un día." };
  if (!esHoraValida(desde) || !esHoraValida(hasta)) {
    return { ok: false, error: "Elegí la hora de inicio y de fin." };
  }
  if (hasta <= desde) {
    return { ok: false, error: "La hora de fin tiene que ser después de la de inicio." };
  }

  try {
    await query(
      `insert into horarios (dia_semana, desde, hasta, profesional_id, lugar_id)
       select d, $2::time, $3::time, $4, $5 from unnest($1::int[]) as d`,
      [
        dias,
        desde,
        hasta,
        profesional === SIN_PROFESIONAL ? null : profesional,
        lugar === SIN_LUGAR ? null : lugar,
      ],
    );
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error, "No pudimos guardar el horario.");
  }
}

export async function eliminarHorario(id: string): Promise<EstadoFormulario> {
  if (!(await esAdministrador())) return SIN_PERMISO;
  try {
    await query("delete from horarios where id = $1", [id]);
    revalidatePath("/", "layout");
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error, "No pudimos borrar el horario.");
  }
}
