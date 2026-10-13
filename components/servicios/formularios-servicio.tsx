"use client";

import { useTransition } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormularioDialogo } from "@/components/app/formulario-dialogo";
import {
  CampoSelect,
  CampoTexto,
  FilaCampos,
} from "@/components/app/campos-formulario";
import {
  cambiarActivoServicio,
  crearServicio,
  editarServicio,
} from "@/app/(app)/servicios/acciones";
import { DURACIONES_TURNO, SIN_LUGAR, SIN_PROFESIONAL } from "@/lib/labels";
import type { Lugar, Profesional, Servicio } from "@/lib/types";

/** Agrega la opción actual aunque esté inactiva, para no perderla al editar. */
function conActual<T extends { id: string; nombre: string }>(
  lista: T[],
  actual: { id: string | null; nombre: string | null } | undefined,
): { id: string; nombre: string }[] {
  if (!actual?.id || !actual.nombre || lista.some((x) => x.id === actual.id)) return lista;
  return [...lista, { id: actual.id, nombre: actual.nombre }];
}

function CamposServicio({
  servicio,
  lugares,
  profesionales,
  duracionPorDefecto,
}: {
  servicio?: Servicio;
  lugares: Lugar[];
  profesionales: Profesional[];
  duracionPorDefecto: number;
}) {
  const duracion = servicio?.duracionMin ?? duracionPorDefecto;
  const duraciones = DURACIONES_TURNO.includes(duracion)
    ? DURACIONES_TURNO
    : [...DURACIONES_TURNO, duracion].sort((a, b) => a - b);
  const opcionesLugar = conActual(lugares, servicio && { id: servicio.lugarId, nombre: servicio.lugarNombre });
  const opcionesProfesional = conActual(
    profesionales,
    servicio && { id: servicio.profesionalId, nombre: servicio.profesionalNombre },
  );

  return (
    <>
      <CampoTexto
        nombre="nombre"
        etiqueta="Servicio"
        requerido
        maxLength={120}
        defaultValue={servicio?.nombre}
        placeholder="Consulta, rinomodelación, tratamiento facial…"
        autoComplete="off"
      />
      {opcionesLugar.length > 0 && (
        <CampoSelect
          nombre="lugar_id"
          etiqueta="Lugar"
          defaultValue={servicio?.lugarId ?? SIN_LUGAR}
          opciones={[
            { valor: SIN_LUGAR, etiqueta: "Todos los lugares" },
            ...opcionesLugar.map((l) => ({ valor: l.id, etiqueta: l.nombre })),
          ]}
        />
      )}
      <FilaCampos>
        <CampoSelect
          nombre="duracion"
          etiqueta="Duración"
          requerido
          defaultValue={String(duracion)}
          opciones={duraciones.map((m) => ({ valor: String(m), etiqueta: `${m} min` }))}
        />
        {opcionesProfesional.length > 0 && (
          <CampoSelect
            nombre="profesional_id"
            etiqueta="Profesional a cargo"
            defaultValue={servicio?.profesionalId ?? SIN_PROFESIONAL}
            opciones={[
              { valor: SIN_PROFESIONAL, etiqueta: "Cualquiera" },
              ...opcionesProfesional.map((p) => ({ valor: p.id, etiqueta: p.nombre })),
            ]}
          />
        )}
      </FilaCampos>
      <CampoTexto
        nombre="precio"
        etiqueta="Precio ($)"
        type="number"
        min={0}
        step={1}
        inputMode="numeric"
        requerido
        defaultValue={servicio?.precio}
        placeholder="25000"
      />
      <FilaCampos>
        <CampoTexto
          nombre="precio_efectivo"
          etiqueta="En efectivo (opcional)"
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          defaultValue={servicio?.precioEfectivo ?? ""}
        />
        <CampoTexto
          nombre="precio_transferencia"
          etiqueta="Por transferencia (opcional)"
          type="number"
          min={0}
          step={1}
          inputMode="numeric"
          defaultValue={servicio?.precioTransferencia ?? ""}
        />
      </FilaCampos>
      <p className="text-xs text-muted-foreground">
        Si no ponés un precio por medio de pago, se cobra el precio de lista.
      </p>
    </>
  );
}

export function NuevoServicio({
  lugares,
  profesionales,
  duracionPorDefecto,
  textoDisparador = "Nuevo servicio",
}: {
  lugares: Lugar[];
  profesionales: Profesional[];
  duracionPorDefecto: number;
  textoDisparador?: string;
}) {
  return (
    <FormularioDialogo
      titulo="Nuevo servicio"
      descripcion="Lo que se ofrece, dónde, con quién, cuánto dura y cuánto sale."
      textoDisparador={textoDisparador}
      textoGuardar="Agregar servicio"
      accion={crearServicio}
      alGuardar={() => toast.success("Servicio agregado.")}
    >
      <CamposServicio
        lugares={lugares}
        profesionales={profesionales}
        duracionPorDefecto={duracionPorDefecto}
      />
    </FormularioDialogo>
  );
}

export function EditarServicio({
  servicio,
  lugares,
  profesionales,
}: {
  servicio: Servicio;
  lugares: Lugar[];
  profesionales: Profesional[];
}) {
  return (
    <FormularioDialogo
      titulo="Editar servicio"
      descripcion="Los cambios valen para los turnos nuevos."
      textoGuardar="Guardar cambios"
      accion={editarServicio}
      alGuardar={() => toast.success("Cambios guardados.")}
      disparador={
        <Button variant="ghost" size="icon-sm" aria-label={`Editar ${servicio.nombre}`}>
          <Pencil />
        </Button>
      }
    >
      <input type="hidden" name="id" value={servicio.id} />
      <CamposServicio
        servicio={servicio}
        lugares={lugares}
        profesionales={profesionales}
        duracionPorDefecto={servicio.duracionMin}
      />
    </FormularioDialogo>
  );
}

export function CambiarActivoServicio({ servicio }: { servicio: Servicio }) {
  const [pendiente, iniciarTransicion] = useTransition();

  function cambiar() {
    iniciarTransicion(async () => {
      const resultado = await cambiarActivoServicio(servicio.id, !servicio.activo);
      if (resultado.ok) {
        toast.success(servicio.activo ? "Servicio desactivado." : "Servicio activado.");
      } else {
        toast.error(resultado.error);
      }
    });
  }

  return (
    <Button variant="outline" size="sm" onClick={cambiar} disabled={pendiente}>
      {servicio.activo ? "Desactivar" : "Activar"}
    </Button>
  );
}
