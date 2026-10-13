"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { LogOut, Menu, Search } from "lucide-react";
import { cerrarSesion } from "@/lib/auth/acciones";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ContenidoSidebar } from "./sidebar";
import { tituloDeRuta } from "./nav";

interface TopbarProps {
  nombreUsuario: string;
  rolUsuario: string;
  nombreConsultorio: string;
}

export function Topbar({ nombreUsuario, rolUsuario, nombreConsultorio }: TopbarProps) {
  const pathname = usePathname();
  const [navAbierta, setNavAbierta] = useState(false);

  const iniciales = nombreUsuario
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/95 px-4 backdrop-blur sm:px-6">
      <Sheet open={navAbierta} onOpenChange={setNavAbierta}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Abrir menú de navegación"
          >
            <Menu className="size-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-60 border-sidebar-border p-0">
          <SheetTitle className="sr-only">Menú de navegación</SheetTitle>
          <ContenidoSidebar
            nombreConsultorio={nombreConsultorio}
            onNavigate={() => setNavAbierta(false)}
          />
        </SheetContent>
      </Sheet>

      <h1 className="font-heading text-lg font-semibold tracking-tight">
        {tituloDeRuta(pathname)}
      </h1>

      <div className="ml-auto flex items-center gap-2">
        <form action="/pacientes" role="search" className="relative hidden md:block">
          <Search
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            name="q"
            placeholder="Buscar paciente por nombre o teléfono…"
            aria-label="Buscar paciente"
            className="w-72 pl-9"
          />
        </form>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="gap-2 px-1.5"
              aria-label={`Menú de ${nombreUsuario}`}
            >
              <Avatar className="size-8">
                <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                  {iniciales}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium sm:inline">
                {nombreUsuario.split(" ")[0]}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel>
              <p className="text-sm font-medium">{nombreUsuario}</p>
              <p className="text-xs font-normal text-muted-foreground">
                {rolUsuario}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => cerrarSesion()}
              variant="destructive"
            >
              <LogOut className="size-4" />
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
