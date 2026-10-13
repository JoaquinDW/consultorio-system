import {
  BellRing,
  CalendarDays,
  House,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface ItemNav {
  titulo: string;
  href: string;
  icono: LucideIcon;
}

export interface SeccionNav {
  titulo?: string;
  items: ItemNav[];
}

export const SECCIONES_NAV: SeccionNav[] = [
  {
    items: [
      { titulo: "Inicio", href: "/inicio", icono: House },
      { titulo: "Agenda", href: "/agenda", icono: CalendarDays },
      { titulo: "Pacientes", href: "/pacientes", icono: Users },
      { titulo: "Recordatorios", href: "/recordatorios", icono: BellRing },
    ],
  },
];

export const NAV_SECUNDARIA: ItemNav[] = [
  { titulo: "Configuración", href: "/configuracion", icono: Settings },
];

const TODOS_LOS_ITEMS: ItemNav[] = [
  ...SECCIONES_NAV.flatMap((s) => s.items),
  ...NAV_SECUNDARIA,
];

export function tituloDeRuta(pathname: string): string {
  const item = TODOS_LOS_ITEMS.find(
    (i) => pathname === i.href || pathname.startsWith(`${i.href}/`),
  );
  return item?.titulo ?? "Turnos";
}
