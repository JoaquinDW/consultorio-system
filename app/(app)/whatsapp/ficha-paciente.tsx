"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowLeft, CalendarDays, Mail, Phone, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { BadgeEstadoTurno } from "@/components/app/badge-estado-turno";
import { fechaCorta } from "@/lib/fechas";
import { iniciales } from "@/lib/format";
import type { FichaPacienteWa } from "@/lib/types";
import { crearPacienteDesdeConversacion } from "./acciones";

/**
 * Ficha al costado del chat: quién escribe y sus próximos turnos. Si el número
 * no es de un paciente cargado, permite darlo de alta sin salir del chat.
 */
export function FichaPaciente({
  conversacionId,
  paciente,
  nombreWa,
  telefono,
  onCerrar,
}: {
  conversacionId: string;
  paciente: FichaPacienteWa | null;
  /** Nombre del contacto en WhatsApp, para sugerirlo al dar el alta. */
  nombreWa: string;
  telefono: string;
  /** Cierra la ficha en pantallas donde comparte lugar con el hilo. */
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState(nombreWa);
  const [pendiente, iniciarTransicion] = useTransition();

  function crear() {
    iniciarTransicion(async () => {
      const resultado = await crearPacienteDesdeConversacion(conversacionId, nombre);
      if (resultado.ok) toast.success("Paciente vinculado.");
      else toast.error(resultado.error);
    });
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          className="xl:hidden"
          onClick={onCerrar}
          aria-label="Volver a la conversación"
        >
          <ArrowLeft className="size-4" />
        </Button>
        <h2 className="font-heading text-base font-semibold">Paciente</h2>
      </div>

      {paciente ? (
        <div className="flex flex-col gap-4 p-4">
          <div className="flex items-center gap-3">
            <Avatar className="size-10">
              <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                {iniciales(paciente.nombre)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-medium">{paciente.nombre}</p>
              <Link
                href={`/pacientes?q=${encodeURIComponent(paciente.nombre)}`}
                className="text-xs text-muted-foreground underline"
              >
                Ver en Pacientes
              </Link>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 text-sm">
            <p className="flex items-center gap-2 text-muted-foreground">
              <Phone className="size-3.5" aria-hidden="true" />
              {paciente.telefono}
            </p>
            {paciente.email && (
              <p className="flex items-center gap-2 text-muted-foreground">
                <Mail className="size-3.5" aria-hidden="true" />
                {paciente.email}
              </p>
            )}
            {paciente.nota && (
              <p className="rounded-md bg-muted px-2.5 py-2 text-xs text-muted-foreground">
                {paciente.nota}
              </p>
            )}
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Próximos turnos
            </p>
            {paciente.proximosTurnos.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tiene turnos próximos.</p>
            ) : (
              paciente.proximosTurnos.map((t) => (
                <Link
                  key={t.id}
                  href={`/agenda?fecha=${t.fecha}`}
                  className="flex items-center justify-between gap-2 rounded-lg border p-2.5 text-sm transition-colors hover:bg-muted/60"
                >
                  <span>
                    <span className="font-medium capitalize">{fechaCorta(t.fecha)}</span>{" "}
                    · {t.hora}
                    {t.profesional && (
                      <span className="block text-xs text-muted-foreground">
                        {t.profesional}
                      </span>
                    )}
                  </span>
                  <BadgeEstadoTurno estado={t.estado} />
                </Link>
              ))
            )}
            <Button variant="outline" size="sm" asChild className="self-start">
              <Link href="/agenda">
                <CalendarDays aria-hidden="true" />
                Ir a la agenda
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 p-4">
          <p className="text-sm text-muted-foreground">
            El número +{telefono} no está cargado como paciente. Dalo de alta
            para ver sus turnos acá y que el bot lo reconozca.
          </p>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nombre-paciente-wa">Nombre y apellido</Label>
            <Input
              id="nombre-paciente-wa"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del paciente"
            />
          </div>
          <Button onClick={crear} disabled={pendiente || !nombre.trim()} className="self-start">
            <UserPlus aria-hidden="true" />
            {pendiente ? "Guardando…" : "Crear paciente"}
          </Button>
        </div>
      )}
    </div>
  );
}
