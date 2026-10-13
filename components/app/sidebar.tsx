"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_SECUNDARIA, SECCIONES_NAV, type ItemNav } from "./nav";

function EnlaceNav({ item, onNavigate }: { item: ItemNav; onNavigate?: () => void }) {
  const pathname = usePathname();
  const activo =
    pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icono = item.icono;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={activo ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors duration-150",
        activo
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
    >
      <Icono className="size-4.5 shrink-0" aria-hidden="true" />
      {item.titulo}
    </Link>
  );
}

export function ContenidoSidebar({
  nombreConsultorio,
  onNavigate,
}: {
  nombreConsultorio: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <Link
        href="/inicio"
        onClick={onNavigate}
        className="flex items-center gap-2.5 px-5 py-5"
      >
        <span className="flex size-8 items-center justify-center rounded-md bg-sidebar-primary">
          <CalendarCheck className="size-4.5 text-sidebar-primary-foreground" aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="font-heading text-lg leading-tight font-semibold tracking-tight text-white">
            Turnos
          </span>
          <span className="truncate text-xs text-sidebar-foreground">
            {nombreConsultorio}
          </span>
        </span>
      </Link>

      <nav
        aria-label="Navegación principal"
        className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-4"
      >
        {SECCIONES_NAV.map((seccion, i) => (
          <div key={seccion.titulo ?? i} className="flex flex-col gap-1">
            {seccion.titulo && (
              <p className="px-3 pt-4 pb-1 text-[11px] font-semibold tracking-wider text-sidebar-foreground/50 uppercase">
                {seccion.titulo}
              </p>
            )}
            {seccion.items.map((item) => (
              <EnlaceNav key={item.href} item={item} onNavigate={onNavigate} />
            ))}
          </div>
        ))}

        <div className="mt-auto pt-4">
          {NAV_SECUNDARIA.map((item) => (
            <EnlaceNav key={item.href} item={item} onNavigate={onNavigate} />
          ))}
        </div>
      </nav>
    </div>
  );
}

export function Sidebar({ nombreConsultorio }: { nombreConsultorio: string }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 border-r border-sidebar-border lg:block">
      <ContenidoSidebar nombreConsultorio={nombreConsultorio} />
    </aside>
  );
}
