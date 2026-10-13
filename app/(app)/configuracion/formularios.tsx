"use client";

import { useState, useTransition } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormularioDialogo } from "@/components/app/formulario-dialogo";
import {
  CampoSelect,
  CampoTexto,
  FilaCampos,
} from "@/components/app/campos-formulario";
import { ESTADO_INICIAL } from "@/lib/acciones/estado";
import { DIAS_SEMANA } from "@/lib/horarios";
import {
  DURACIONES_TURNO,
  SIN_LUGAR,
  SIN_PROFESIONAL,
  ZONAS_HORARIAS,
} from "@/lib/labels";
import type { Consultorio, FranjaHorario, Lugar, Profesional } from "@/lib/types";
import {
  actualizarConsultorio,
  cambiarActivoLugar,
  cambiarActivoProfesional,
  crearHorarios,
  crearLugar,
  crearProfesional,
  eliminarHorario,
} from "./acciones";
import { cambiarRecordatoriosAutomaticos } from "../whatsapp/acciones";

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

export function NuevoLugar() {
  return (
    <FormularioDialogo
      titulo="Nuevo lugar"
      descripcion="Un consultorio, clínica o sede donde atienden. Cada servicio puede tener su precio según el lugar."
      textoDisparador="Agregar lugar"
      textoGuardar="Agregar"
      accion={crearLugar}
      alGuardar={() => toast.success("Lugar agregado.")}
    >
      <CampoTexto nombre="nombre" etiqueta="Nombre" requerido maxLength={120} placeholder="Clínica Norte" />
      <CampoTexto nombre="direccion" etiqueta="Dirección (opcional)" maxLength={200} />
    </FormularioDialogo>
  );
}

export function CambiarActivoLugar({ lugar }: { lugar: Lugar }) {
  const [pendiente, iniciarTransicion] = useTransition();

  function cambiar() {
    iniciarTransicion(async () => {
      const resultado = await cambiarActivoLugar(lugar.id, !lugar.activo);
      if (resultado.ok) {
        toast.success(lugar.activo ? "Lugar desactivado." : "Lugar activado.");
      } else {
        toast.error(resultado.error);
      }
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={cambiar} disabled={pendiente}>
      {lugar.activo ? "Desactivar" : "Activar"}
    </Button>
  );
}

export function NuevoHorario({
  profesionales,
  lugares,
}: {
  profesionales: Profesional[];
  lugares: Lugar[];
}) {
  return (
    <FormularioDialogo
      titulo="Nuevo horario de atención"
      descripcion="Fuera de estos horarios no se pueden dar turnos. Para cortar al mediodía, cargá dos franjas (mañana y tarde)."
      textoDisparador="Agregar horario"
      textoGuardar="Agregar"
      accion={crearHorarios}
      alGuardar={() => toast.success("Horario agregado.")}
    >
      <fieldset className="flex flex-col gap-1.5">
        <legend className="text-sm leading-none font-medium">
          Días<span className="text-destructive">*</span>
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {DIAS_SEMANA.map((d) => (
            <label
              key={d.valor}
              className="flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm has-checked:border-primary has-checked:bg-primary/5"
            >
              <input
                type="checkbox"
                name="dias"
                value={d.valor}
                defaultChecked={d.valor <= 5}
                className="size-3.5 accent-primary"
              />
              {d.corta}
            </label>
          ))}
        </div>
      </fieldset>
      <FilaCampos>
        <CampoTexto nombre="desde" etiqueta="Desde" type="time" step={300} requerido defaultValue="09:00" />
        <CampoTexto nombre="hasta" etiqueta="Hasta" type="time" step={300} requerido defaultValue="13:00" />
      </FilaCampos>
      {profesionales.length > 0 && (
        <CampoSelect
          nombre="profesional_id"
          etiqueta="De quién"
          defaultValue={SIN_PROFESIONAL}
          opciones={[
            { valor: SIN_PROFESIONAL, etiqueta: "Horario general del consultorio" },
            ...profesionales.map((p) => ({ valor: p.id, etiqueta: p.nombre })),
          ]}
        />
      )}
      {lugares.length > 0 && (
        <CampoSelect
          nombre="lugar_id"
          etiqueta="Dónde (opcional)"
          defaultValue={SIN_LUGAR}
          opciones={[
            { valor: SIN_LUGAR, etiqueta: "Cualquier lugar" },
            ...lugares.map((l) => ({ valor: l.id, etiqueta: l.nombre })),
          ]}
        />
      )}
    </FormularioDialogo>
  );
}

export function EliminarHorario({ franja }: { franja: FranjaHorario }) {
  const [pendiente, iniciarTransicion] = useTransition();

  function eliminar() {
    iniciarTransicion(async () => {
      const resultado = await eliminarHorario(franja.id);
      if (resultado.ok) toast.success("Horario borrado.");
      else toast.error(resultado.error);
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={eliminar}
      disabled={pendiente}
      aria-label={`Borrar ${franja.desde}–${franja.hasta}`}
      title="Borrar"
    >
      <X />
    </Button>
  );
}

export function ToggleRecordatoriosAutomaticos({
  activo,
  editable,
}: {
  activo: boolean;
  editable: boolean;
}) {
  const [valor, setValor] = useState(activo);
  const [pendiente, iniciarTransicion] = useTransition();

  function cambiar(nuevo: boolean) {
    setValor(nuevo);
    iniciarTransicion(async () => {
      const resultado = await cambiarRecordatoriosAutomaticos(nuevo);
      if (resultado.ok) {
        toast.success(
          nuevo
            ? "Los recordatorios se van a mandar solos por WhatsApp."
            : "Recordatorios automáticos apagados.",
        );
      } else {
        setValor(!nuevo);
        toast.error(resultado.error);
      }
    });
  }

  return (
    <label className="flex items-start gap-3 text-sm">
      <input
        type="checkbox"
        className="mt-0.5 size-4 accent-primary"
        checked={valor}
        disabled={!editable || pendiente}
        onChange={(e) => cambiar(e.target.checked)}
      />
      <span>
        <span className="font-medium">Mandar los recordatorios automáticamente</span>
        <span className="block text-xs text-muted-foreground">
          Con el bot conectado, cada turno recibe su recordatorio por WhatsApp
          cuando entra en la anticipación configurada. Si el paciente responde
          «sí», el turno queda confirmado.
        </span>
      </span>
    </label>
  );
}
