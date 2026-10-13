import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ESTADOS_TURNO } from "@/lib/labels";
import type { EstadoTurno } from "@/lib/types";

export function BadgeEstadoTurno({ estado }: { estado: EstadoTurno }) {
  const { etiqueta, className } = ESTADOS_TURNO[estado];
  return (
    <Badge variant="outline" className={cn("font-medium", className)}>
      {etiqueta}
    </Badge>
  );
}
