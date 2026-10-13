"use client";

import { useActionState } from "react";
import { CalendarCheck, Loader2 } from "lucide-react";
import { iniciarSesion, type EstadoLogin } from "@/lib/auth/acciones";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const ESTADO_INICIAL: EstadoLogin = {};

export default function LoginPage() {
  const [estado, accion, enviando] = useActionState(
    iniciarSesion,
    ESTADO_INICIAL,
  );

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-sidebar p-4">
      <div className="mb-8 flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-lg bg-sidebar-primary">
          <CalendarCheck className="size-6 text-white" aria-hidden="true" />
        </span>
        <div>
          <p className="font-heading text-2xl font-semibold tracking-tight text-white">
            Turnos
          </p>
          <p className="text-sm text-sidebar-foreground">
            Agenda y recordatorios para tu consultorio
          </p>
        </div>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-heading text-xl">Iniciá sesión</CardTitle>
          <CardDescription>
            Ingresá con el usuario de tu consultorio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={accion} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="vos@tuconsultorio.com"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </div>
            {estado.error && (
              <p role="alert" className="text-sm text-destructive">
                {estado.error}
              </p>
            )}

            <Button type="submit" disabled={enviando} className="w-full">
              {enviando && (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              )}
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>

    </div>
  );
}
