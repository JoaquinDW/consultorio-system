"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ESTADO_INICIAL,
  type EstadoFormulario,
} from "@/lib/acciones/estado";

type AccionFormulario = (
  estado: EstadoFormulario,
  formData: FormData,
) => Promise<EstadoFormulario>;

/**
 * Botón "Agregar" que abre un diálogo con un formulario conectado a una
 * Server Action. Cierra al guardar con éxito y muestra el error inline si falla.
 * Los campos se pasan como `children`.
 */
export function FormularioDialogo({
  titulo,
  descripcion,
  textoDisparador = "Agregar",
  textoGuardar = "Guardar",
  disparador,
  abierto: abiertoControlado,
  alCambiarAbierto,
  accion,
  alGuardar,
  children,
}: {
  titulo: string;
  descripcion?: string;
  textoDisparador?: string;
  textoGuardar?: string;
  /**
   * Reemplaza el botón "Agregar" por defecto (por ejemplo, un ícono de editar).
   * `null` no muestra disparador: el diálogo se abre desde afuera con `abierto`.
   */
  disparador?: ReactNode | null;
  /** Modo controlado (p. ej. abrir el diálogo desde un menú). */
  abierto?: boolean;
  alCambiarAbierto?: (abierto: boolean) => void;
  accion: AccionFormulario;
  /** Se llama después de guardar con éxito (p. ej. para mostrar un toast). */
  alGuardar?: () => void;
  children: ReactNode;
}) {
  const [abiertoInterno, setAbiertoInterno] = useState(false);
  const abierto = abiertoControlado ?? abiertoInterno;
  const setAbierto = alCambiarAbierto ?? setAbiertoInterno;
  const [error, setError] = useState<string>();
  const [pendiente, iniciarTransicion] = useTransition();

  // Manejamos el resultado en el callback de la acción (no en un effect):
  // al guardar con éxito cerramos el diálogo; si falla, mostramos el error.
  function enviar(formData: FormData) {
    iniciarTransicion(async () => {
      const resultado = await accion(ESTADO_INICIAL, formData);
      if (resultado.ok) {
        setError(undefined);
        setAbierto(false);
        alGuardar?.();
      } else {
        setError(resultado.error);
      }
    });
  }

  function cambiarApertura(nuevo: boolean) {
    setAbierto(nuevo);
    if (!nuevo) setError(undefined);
  }

  return (
    <Dialog open={abierto} onOpenChange={cambiarApertura}>
      {disparador !== null && (
        <DialogTrigger asChild>
          {disparador ?? (
            <Button>
              <Plus aria-hidden="true" />
              {textoDisparador}
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
          {descripcion && <DialogDescription>{descripcion}</DialogDescription>}
        </DialogHeader>
        <form action={enviar} className="flex flex-col gap-3">
          {children}
          {error && (
            <p className="text-xs text-destructive" role="alert">
              {error}
            </p>
          )}
          <DialogFooter className="mt-1">
            <Button type="submit" disabled={pendiente}>
              {pendiente ? "Guardando…" : textoGuardar}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
