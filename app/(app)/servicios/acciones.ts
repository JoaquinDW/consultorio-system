"use server";

import { revalidatePath } from "next/cache";
import { query } from "@/lib/db/pool";
import { esAdministrador } from "@/lib/auth";
import {
  aNumero,
  aTexto,
  mensajeDeError,
  type EstadoFormulario,
} from "@/lib/acciones/estado";
import { SIN_LUGAR, SIN_PROFESIONAL } from "@/lib/labels";

const SIN_PERMISO: EstadoFormulario = {
  ok: false,
  error: "Solo quien administra el consultorio puede cambiar los servicios.",
};

function revalidar() {
  revalidatePath("/servicios");
  revalidatePath("/agenda");
  revalidatePath("/inicio");
  revalidatePath("/pacientes");
}

interface DatosServicio {
  nombre: string;
  lugarId: string | null;
  profesionalId: string | null;
  duracion: number;
  precio: number;
  precioEfectivo: number | null;
  precioTransferencia: number | null;
}

function leerPrecio(
  formData: FormData,
  campo: string,
): number | null | { error: string } {
  const crudo = aTexto(formData.get(campo));
  if (crudo === null) return null;
  const valor = aNumero(crudo);
  if (valor === null || valor < 0 || valor > 9_999_999_999) {
    return { error: "Los precios tienen que ser números positivos (sin puntos de miles)." };
  }
  return valor;
}

function leerServicio(formData: FormData): DatosServicio | { error: string } {
  const nombre = String(formData.get("nombre") ?? "").trim();
  const lugar = aTexto(formData.get("lugar_id"));
  const profesional = aTexto(formData.get("profesional_id"));
  const duracion = Number(formData.get("duracion"));
  const precio = leerPrecio(formData, "precio");
  const precioEfectivo = leerPrecio(formData, "precio_efectivo");
  const precioTransferencia = leerPrecio(formData, "precio_transferencia");

  if (!nombre) return { error: "Poné el nombre del servicio." };
  if (nombre.length > 120) return { error: "El nombre puede tener hasta 120 caracteres." };
  if (!Number.isInteger(duracion) || duracion < 5 || duracion > 480) {
    return { error: "La duración tiene que ser de 5 a 480 minutos." };
  }
  if (precio === null) return { error: "Poné el precio del servicio." };
  for (const p of [precio, precioEfectivo, precioTransferencia]) {
    if (p !== null && typeof p === "object") return p;
  }

  return {
    nombre,
    lugarId: lugar === SIN_LUGAR ? null : lugar,
    profesionalId: profesional === SIN_PROFESIONAL ? null : profesional,
    duracion,
    precio: precio as number,
    precioEfectivo: precioEfectivo as number | null,
    precioTransferencia: precioTransferencia as number | null,
  };
}

export async function crearServicio(
  _prev: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  if (!(await esAdministrador())) return SIN_PERMISO;
  const datos = leerServicio(formData);
  if ("error" in datos) return { ok: false, error: datos.error };

  try {
    await query(
      `insert into servicios
         (nombre, lugar_id, profesional_id, duracion_min, precio, precio_efectivo, precio_transferencia)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [
        datos.nombre,
        datos.lugarId,
        datos.profesionalId,
        datos.duracion,
        datos.precio,
        datos.precioEfectivo,
        datos.precioTransferencia,
      ],
    );
    revalidar();
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error, "No pudimos agregar el servicio.");
  }
}

export async function editarServicio(
  _prev: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  if (!(await esAdministrador())) return SIN_PERMISO;
  const id = String(formData.get("id") ?? "");
  const datos = leerServicio(formData);
  if (!id) return { ok: false, error: "Falta el servicio a editar." };
  if ("error" in datos) return { ok: false, error: datos.error };

  try {
    await query(
      `update servicios
       set nombre = $2, lugar_id = $3, profesional_id = $4, duracion_min = $5,
           precio = $6, precio_efectivo = $7, precio_transferencia = $8,
           actualizado_en = now()
       where id = $1`,
      [
        id,
        datos.nombre,
        datos.lugarId,
        datos.profesionalId,
        datos.duracion,
        datos.precio,
        datos.precioEfectivo,
        datos.precioTransferencia,
      ],
    );
    revalidar();
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error, "No pudimos guardar el servicio.");
  }
}

/** Desactivar no borra: los turnos que lo usan lo siguen mostrando. */
export async function cambiarActivoServicio(
  id: string,
  activo: boolean,
): Promise<EstadoFormulario> {
  if (!(await esAdministrador())) return SIN_PERMISO;
  try {
    await query(
      "update servicios set activo = $2, actualizado_en = now() where id = $1",
      [id, activo],
    );
    revalidar();
    return { ok: true };
  } catch (error) {
    return mensajeDeError(error, "No pudimos actualizar el servicio.");
  }
}
