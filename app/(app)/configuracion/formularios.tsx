"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormularioDialogo } from "@/components/app/formulario-dialogo";
import {
  CampoSelect,
  CampoTexto,
  FilaCampos,
} from "@/components/app/campos-formulario";
import { ESTADO_INICIAL } from "@/lib/acciones/estado";
import { DURACIONES_TURNO, ZONAS_HORARIAS } from "@/lib/labels";
import type { Consultorio, Profesional } from "@/lib/types";
import {
  actualizarConsultorio,
  cambiarActivoProfesional,
  crearProfesional,
} from "./acciones";

export function FormularioConsultorio({
  consultorio,
  editable,
}: {
  consultorio: Consultorio;
  editable: boolean;
}) {
  const [error, setError] = useState<string>();
  const [pendiente, iniciarTransicion] = useTransition();

  function enviar(formData: FormData) {
    iniciarTransicion(async () => {
      const resultado = await actualizarConsultorio(ESTADO_INICIAL, formData);
      if (resultado.ok) {
        setError(undefined);
        toast.success("Configuración guardada.");
      } else {
        setError(resultado.error);
      }
    });
  }

  const zonas = ZONAS_HORARIAS.includes(consultorio.zonaHoraria)
    ? ZONAS_HORARIAS
    : [consultorio.zonaHoraria, ...ZONAS_HORARIAS];
  const duraciones = DURACIONES_TURNO.includes(consultorio.duracionTurnoMin)
    ? DURACIONES_TURNO
    : [...DURACIONES_TURNO, consultorio.duracionTurnoMin].sort((a, b) => a - b);

  return (
    <form action={enviar} className="flex flex-col gap-3">
      <fieldset disabled={!editable || pendiente} className="flex flex-col gap-3">
        <CampoTexto
          nombre="nombre"
          etiqueta="Nombre del consultorio"
          requerido
          defaultValue={consultorio.nombre}
        />
        <CampoSelect
          nombre="zona_horaria"
          etiqueta="Zona horaria de la agenda"
          requerido
          defaultValue={consultorio.zonaHoraria}
          opciones={zonas.map((z) => ({ valor: z, etiqueta: z.replaceAll("_", " ") }))}
        />
        <FilaCampos>
          <CampoSelect
            nombre="duracion_turno_min"
            etiqueta="Duración por defecto"
            requerido
            defaultValue={String(consultorio.duracionTurnoMin)}
            opciones={duraciones.map((m) => ({ valor: String(m), etiqueta: `${m} min` }))}
          />
          <CampoTexto
            nombre="recordatorio_horas_antes"
            etiqueta="Recordar con (horas antes)"
            type="number"
            min={1}
            max={168}
            requerido
            defaultValue={consultorio.recordatorioHorasAntes}
          />
        </FilaCampos>
      </fieldset>
      <p className="text-xs text-muted-foreground">
        Cambiar la zona horaria no mueve los turnos: siguen en el mismo momento
        real y se muestran con la hora de la zona nueva.
      </p>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      {editable && (
        <Button type="submit" disabled={pendiente} className="self-start">
          {pendiente ? "Guardando…" : "Guardar"}
        </Button>
      )}
    </form>
  );
}

export function NuevoProfesional() {
  return (
    <FormularioDialogo
      titulo="Nuevo profesional"
      descripcion="Cada profesional tiene su propia agenda: sus turnos no se pueden superponer."
      textoDisparador="Agregar profesional"
      textoGuardar="Agregar"
      accion={crearProfesional}
      alGuardar={() => toast.success("Profesional agregado.")}
    >
      <CampoTexto nombre="nombre" etiqueta="Nombre" requerido placeholder="Dra. Ana Pérez" />
      <CampoTexto nombre="especialidad" etiqueta="Especialidad (opcional)" />
    </FormularioDialogo>
  );
}

export function CambiarActivoProfesional({ profesional }: { profesional: Profesional }) {
  const [pendiente, iniciarTransicion] = useTransition();

  function cambiar() {
    iniciarTransicion(async () => {
      const resultado = await cambiarActivoProfesional(profesional.id, !profesional.activo);
      if (resultado.ok) {
        toast.success(profesional.activo ? "Profesional desactivado." : "Profesional activado.");
      } else {
        toast.error(resultado.error);
      }
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={cambiar} disabled={pendiente}>
      {profesional.activo ? "Desactivar" : "Activar"}
    </Button>
  );
}
