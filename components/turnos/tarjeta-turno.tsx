"use client";

import { useState, useTransition } from "react";
import {
  BellRing,
  CalendarClock,
  Check,
  CheckCheck,
  MoreHorizontal,
  Phone,
  RotateCcw,
  Stethoscope,
  X,
} from "lucide-react";
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
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BadgeEstadoTurno } from "@/components/app/badge-estado-turno";
import { cambiarEstadoTurno } from "@/app/(app)/agenda/acciones";
import { cn } from "@/lib/utils";
import { fechaCorta } from "@/lib/fechas";
import type { EstadoTurno, Profesional, Turno } from "@/lib/types";
import { DialogoRecordatorio } from "./dialogo-recordatorio";
import { ReprogramarTurno } from "./formulario-turno";

type Dialogo = "reprogramar" | "recordatorio" | "cancelar" | null;

const MENSAJES_ESTADO: Record<EstadoTurno, string> = {
  pendiente: "Turno vuelto a pendiente.",
  confirmado: "Turno confirmado.",
  cancelado: "Turno cancelado.",
  realizado: "Turno marcado como realizado.",
};

/**
 * Un turno en la agenda o en el inicio, con sus acciones: confirmar, marcar
 * realizado, reprogramar, cancelar y preparar el recordatorio.
 * `compacta` es la variante de la vista semanal.
 */
export function TarjetaTurno({
  turno,
  profesionales,
  zonaHoraria,
  compacta = false,
  mostrarFecha = false,
}: {
  turno: Turno;
  profesionales: Profesional[];
  zonaHoraria: string;
  compacta?: boolean;
  mostrarFecha?: boolean;
}) {
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [pendiente, iniciarTransicion] = useTransition();

  const activo = turno.estado === "pendiente" || turno.estado === "confirmado";
  const puedeRecordar = activo && !turno.pasado;

  function cambiarEstado(estado: EstadoTurno) {
    iniciarTransicion(async () => {
      const resultado = await cambiarEstadoTurno(turno.id, estado);
      if (resultado.ok) toast.success(MENSAJES_ESTADO[estado]);
      else toast.error(resultado.error);
    });
  }

  const cerrar = (abierto: boolean) => !abierto && setDialogo(null);

  return (
    <div
      className={cn(
        "relative flex gap-3 rounded-lg border bg-card p-3 transition-opacity",
        !activo && "opacity-70",
        pendiente && "opacity-50",
        compacta && "flex-col gap-1.5 p-2.5",
      )}
    >
      <div className={cn("shrink-0", compacta ? "flex items-baseline gap-1.5 pr-7 whitespace-nowrap" : "w-14")}>
        <p className="font-heading text-sm font-semibold tabular-nums">{turno.hora}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {compacta && "– "}
          {turno.horaFin}
        </p>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={cn("font-medium", compacta ? "text-sm leading-snug break-words" : "truncate")}>
            {turno.pacienteNombre}
          </p>
          <BadgeEstadoTurno estado={turno.estado} />
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {mostrarFecha && <span className="capitalize">{fechaCorta(turno.fecha)}</span>}
          {!compacta && (
            <span className="flex items-center gap-1">
              <Phone className="size-3" aria-hidden="true" />
              {turno.pacienteTelefono}
            </span>
          )}
          {turno.profesionalNombre && (
            <span className="flex items-center gap-1">
              <Stethoscope className="size-3" aria-hidden="true" />
              {turno.profesionalNombre}
            </span>
          )}
          {activo && turno.recordatorioEnviadoEn && (
            <span className="flex items-center gap-1 text-success">
              <BellRing className="size-3" aria-hidden="true" />
              Recordado
            </span>
          )}
        </div>
        {turno.nota && !compacta && (
          <p className="text-xs text-muted-foreground">{turno.nota}</p>
        )}
      </div>

      <div
        className={cn(
          "flex shrink-0 items-start gap-1",
          compacta && "absolute top-1.5 right-1.5",
        )}
      >
        {puedeRecordar && !turno.recordatorioEnviadoEn && !compacta && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialogo("recordatorio")}
            className="hidden sm:inline-flex"
          >
            <BellRing aria-hidden="true" />
            Recordar
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Acciones del turno de ${turno.pacienteNombre}`}
              disabled={pendiente}
            >
              <MoreHorizontal />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {turno.estado === "pendiente" && (
              <DropdownMenuItem onClick={() => cambiarEstado("confirmado")}>
                <Check className="size-4" />
                Confirmar
              </DropdownMenuItem>
            )}
            {activo && (
              <DropdownMenuItem onClick={() => cambiarEstado("realizado")}>
                <CheckCheck className="size-4" />
                Marcar realizado
              </DropdownMenuItem>
            )}
            {turno.estado === "confirmado" && (
              <DropdownMenuItem onClick={() => cambiarEstado("pendiente")}>
                <RotateCcw className="size-4" />
                Volver a pendiente
              </DropdownMenuItem>
            )}
            {activo && (
              <DropdownMenuItem onClick={() => setDialogo("reprogramar")}>
                <CalendarClock className="size-4" />
                Reprogramar
              </DropdownMenuItem>
            )}
            {puedeRecordar && (
              <DropdownMenuItem onClick={() => setDialogo("recordatorio")}>
                <BellRing className="size-4" />
                {turno.recordatorioEnviadoEn ? "Ver recordatorio" : "Preparar recordatorio"}
              </DropdownMenuItem>
            )}
            {turno.estado === "cancelado" && (
              <DropdownMenuItem onClick={() => cambiarEstado("pendiente")}>
                <RotateCcw className="size-4" />
                Reactivar
              </DropdownMenuItem>
            )}
            {activo && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => setDialogo("cancelar")}
                >
                  <X className="size-4" />
                  Cancelar turno
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {activo && (
        <ReprogramarTurno
          turno={turno}
          profesionales={profesionales}
          zonaHoraria={zonaHoraria}
          abierto={dialogo === "reprogramar"}
          alCambiarAbierto={cerrar}
        />
      )}
      {puedeRecordar && (
        <DialogoRecordatorio
          turno={turno}
          abierto={dialogo === "recordatorio"}
          alCambiarAbierto={cerrar}
        />
      )}
      <AlertDialog open={dialogo === "cancelar"} onOpenChange={cerrar}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar el turno?</AlertDialogTitle>
            <AlertDialogDescription>
              {turno.pacienteNombre}, {turno.fecha} a las {turno.hora}. El
              horario queda libre. Si te arrepentís, lo podés reactivar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => cambiarEstado("cancelado")}
            >
              Cancelar turno
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
