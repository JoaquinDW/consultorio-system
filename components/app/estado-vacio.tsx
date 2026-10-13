import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

/** Estado vacío: explica qué falta y qué hacer, con una acción opcional. */
export function EstadoVacio({
  icono: Icono,
  titulo,
  descripcion,
  children,
}: {
  icono: LucideIcon;
  titulo: string;
  descripcion: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
      <Icono className="size-8 text-muted-foreground" aria-hidden="true" />
      <p className="font-medium">{titulo}</p>
      <p className="max-w-sm text-sm text-muted-foreground">{descripcion}</p>
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}
