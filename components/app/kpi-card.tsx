import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatearPorcentaje } from "@/lib/format";

interface KpiCardProps {
  etiqueta: string;
  valor: string;
  icono: LucideIcon;
  deltaPct?: number;
  subirEsBueno?: boolean;
  destacado?: boolean;
}

export function KpiCard({
  etiqueta,
  valor,
  icono: Icono,
  deltaPct,
  subirEsBueno = true,
  destacado = false,
}: KpiCardProps) {
  const sube = deltaPct !== undefined && deltaPct >= 0;
  const positivo = deltaPct !== undefined && sube === subirEsBueno;

  return (
    <Card className={cn(destacado && "border-destructive/40")}>
      <CardContent className="flex flex-col gap-2 px-5 py-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">{etiqueta}</p>
          <Icono
            className={cn(
              "size-4",
              destacado ? "text-destructive" : "text-muted-foreground",
            )}
            aria-hidden="true"
          />
        </div>
        <div className="flex items-baseline gap-2">
          <p className="font-heading text-2xl font-semibold tracking-tight">
            {valor}
          </p>
          {deltaPct !== undefined && (
            <span
              className={cn(
                "flex items-center gap-0.5 text-xs font-medium",
                positivo ? "text-success" : "text-destructive",
              )}
            >
              {sube ? (
                <ArrowUpRight className="size-3.5" aria-hidden="true" />
              ) : (
                <ArrowDownRight className="size-3.5" aria-hidden="true" />
              )}
              {formatearPorcentaje(Math.abs(deltaPct))}
              <span className="sr-only">
                {sube ? "más" : "menos"} que ayer
              </span>
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
