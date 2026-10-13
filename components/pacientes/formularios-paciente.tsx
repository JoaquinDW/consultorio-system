"use client";

import { useTransition } from "react";
import { Archive, ArchiveRestore, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FormularioDialogo } from "@/components/app/formulario-dialogo";
import {
  CampoTextarea,
  CampoTexto,
  FilaCampos,
} from "@/components/app/campos-formulario";
import {
  cambiarArchivoPaciente,
  crearPaciente,
  editarPaciente,
} from "@/app/(app)/pacientes/acciones";
import type { Paciente } from "@/lib/types";

function CamposPaciente({ paciente }: { paciente?: Paciente }) {
  return (
    <>
      <CampoTexto
        nombre="nombre"
        etiqueta="Nombre y apellido"
        requerido
        defaultValue={paciente?.nombre}
        autoComplete="off"
      />
      <FilaCampos>
        <CampoTexto
          nombre="telefono"
          etiqueta="Teléfono (WhatsApp)"
          type="tel"
          requerido
          defaultValue={paciente?.telefono}
          placeholder="+54 9 351 555 0101"
        />
        <CampoTexto
          nombre="email"
          etiqueta="Email"
          type="email"
          defaultValue={paciente?.email ?? ""}
        />
      </FilaCampos>
      <CampoTextarea
        nombre="nota"
        etiqueta="Nota administrativa"
        maxLength={500}
        defaultValue={paciente?.nota ?? ""}
        placeholder="Ej.: prefiere turnos por la tarde. No cargues datos clínicos."
      />
    </>
  );
}

export function NuevoPaciente({ textoDisparador = "Nuevo paciente" }: { textoDisparador?: string }) {
  return (
    <FormularioDialogo
      titulo="Nuevo paciente"
      descripcion="Solo datos de contacto. Este sistema no guarda información clínica."
      textoDisparador={textoDisparador}
      textoGuardar="Agregar paciente"
      accion={crearPaciente}
      alGuardar={() => toast.success("Paciente agregado.")}
    >
      <CamposPaciente />
    </FormularioDialogo>
  );
}

export function EditarPaciente({ paciente }: { paciente: Paciente }) {
  return (
    <FormularioDialogo
      titulo="Editar paciente"
      textoGuardar="Guardar cambios"
      accion={editarPaciente}
      alGuardar={() => toast.success("Cambios guardados.")}
      disparador={
        <Button variant="ghost" size="icon-sm" aria-label={`Editar a ${paciente.nombre}`}>
          <Pencil />
        </Button>
      }
    >
      <input type="hidden" name="id" value={paciente.id} />
      <CamposPaciente paciente={paciente} />
    </FormularioDialogo>
  );
}

export function ArchivarPaciente({ paciente }: { paciente: Paciente }) {
  const [pendiente, iniciarTransicion] = useTransition();
  const archivar = !paciente.archivado;

  function cambiar() {
    iniciarTransicion(async () => {
      const resultado = await cambiarArchivoPaciente(paciente.id, archivar);
      if (resultado.ok) {
        toast.success(archivar ? "Paciente archivado." : "Paciente restaurado.");
      } else {
        toast.error(resultado.error);
      }
    });
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={cambiar}
      disabled={pendiente}
      aria-label={archivar ? `Archivar a ${paciente.nombre}` : `Restaurar a ${paciente.nombre}`}
      title={archivar ? "Archivar" : "Restaurar"}
    >
      {archivar ? <Archive /> : <ArchiveRestore />}
    </Button>
  );
}
