"use client";

import { useTransition } from "react";
import { Archive, ArchiveRestore, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
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
  eliminarPaciente,
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

export function EliminarPaciente({ paciente }: { paciente: Paciente }) {
  const [pendiente, iniciarTransicion] = useTransition();

  function eliminar() {
    iniciarTransicion(async () => {
      const resultado = await eliminarPaciente(paciente.id);
      if (resultado.ok) {
        toast.success("Paciente eliminado.");
      } else {
        toast.error(resultado.error);
      }
    });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          disabled={pendiente}
          aria-label={`Eliminar a ${paciente.nombre}`}
          title="Eliminar"
          className="text-destructive hover:text-destructive"
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>¿Eliminar a {paciente.nombre}?</AlertDialogTitle>
          <AlertDialogDescription>
            Se borran el paciente y todos sus turnos (pasados y futuros), con
            sus recordatorios. Las conversaciones de WhatsApp quedan, pero sin
            paciente vinculado. No se puede deshacer: si solo querés sacarlo de
            la lista, archivalo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={eliminar}>
            Eliminar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
