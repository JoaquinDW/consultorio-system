import Link from "next/link";
import { HandCoins } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EstadoVacio } from "@/components/app/estado-vacio";
import {
  CambiarActivoServicio,
  EditarServicio,
  NuevoServicio,
} from "@/components/servicios/formularios-servicio";
import { usuarioActual } from "@/lib/auth";
import {
  obtenerConsultorio,
  obtenerLugares,
  obtenerProfesionales,
  obtenerServicios,
} from "@/lib/data";
import { preciosServicio } from "@/lib/servicios";
import { cn } from "@/lib/utils";

export const metadata = { title: "Servicios" };

function primero(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? "";
}

export default async function ServiciosPage({
  searchParams,
}: {
  searchParams: Promise<{ [clave: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const [usuario, consultorio, lugares, profesionales] = await Promise.all([
    usuarioActual(),
    obtenerConsultorio(),
    obtenerLugares(),
    obtenerProfesionales(),
  ]);
  const esAdmin = usuario.rol === "administrador";
  const lugarId = lugares.find((l) => l.id === primero(params.lugar))?.id ?? null;
  const servicios = await obtenerServicios({ incluirInactivos: esAdmin, lugarId });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-semibold tracking-tight">Servicios</h2>
          <p className="text-sm text-muted-foreground">
            {esAdmin
              ? "Qué se ofrece en cada lugar, con quién, cuánto dura y cuánto sale."
              : "Precios y duraciones vigentes. Solo quien administra el consultorio los puede cambiar."}
          </p>
        </div>
        {esAdmin && (
          <NuevoServicio
            lugares={lugares}
            profesionales={profesionales}
            duracionPorDefecto={consultorio.duracionTurnoMin}
          />
        )}
      </div>

      {lugares.length > 0 && (
        <div className="flex w-fit flex-wrap rounded-md border p-0.5" role="group" aria-label="Lugar">
          {[{ id: null, nombre: "Todos" }, ...lugares].map((l) => (
            <Link
              key={l.id ?? "todos"}
              href={l.id ? `/servicios?lugar=${l.id}` : "/servicios"}
              aria-current={lugarId === l.id ? "page" : undefined}
              className={cn(
                "rounded-sm px-3 py-1 text-sm font-medium transition-colors",
                lugarId === l.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {l.nombre}
            </Link>
          ))}
        </div>
      )}

      <Card className="py-0">
        <CardContent className="px-0">
          {servicios.length === 0 ? (
            <EstadoVacio
              icono={HandCoins}
              titulo={lugarId ? "No hay servicios en este lugar" : "Todavía no cargaste servicios"}
              descripcion={
                esAdmin
                  ? "Cargá lo que ofrecés con su precio y duración. Al dar un turno, elegir el servicio completa la duración y el profesional."
                  : "Cuando quien administra el consultorio cargue los servicios, los vas a ver acá con sus precios."
              }
            >
              {esAdmin && (
                <NuevoServicio
                  lugares={lugares}
                  profesionales={profesionales}
                  duracionPorDefecto={consultorio.duracionTurnoMin}
                  textoDisparador="Agregar servicio"
                />
              )}
            </EstadoVacio>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Servicio</TableHead>
                    <TableHead className="hidden md:table-cell">Profesional</TableHead>
                    <TableHead>Duración</TableHead>
                    <TableHead>Precio</TableHead>
                    {esAdmin && (
                      <TableHead className="pr-4 text-right">
                        <span className="sr-only">Acciones</span>
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {servicios.map((s) => {
                    const precios = preciosServicio(s);
                    return (
                      <TableRow key={s.id} className={cn(!s.activo && "opacity-60")}>
                        <TableCell className="pl-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium">{s.nombre}</p>
                            {!s.activo && (
                              <Badge variant="outline" className="text-muted-foreground">
                                Inactivo
                              </Badge>
                            )}
                          </div>
                          {lugares.length > 0 && (
                            <p className="text-xs text-muted-foreground">
                              {s.lugarNombre ?? "Todos los lugares"}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">
                          {s.profesionalNombre ?? "Cualquiera"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">
                          {s.duracionMin} min
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">
                          <p className="font-medium">{precios.lista}</p>
                          {precios.efectivo && (
                            <p className="text-xs text-muted-foreground">
                              Efectivo: {precios.efectivo}
                            </p>
                          )}
                          {precios.transferencia && (
                            <p className="text-xs text-muted-foreground">
                              Transferencia: {precios.transferencia}
                            </p>
                          )}
                        </TableCell>
                        {esAdmin && (
                          <TableCell className="pr-4">
                            <div className="flex items-center justify-end gap-1">
                              <EditarServicio
                                servicio={s}
                                lugares={lugares}
                                profesionales={profesionales}
                              />
                              <CambiarActivoServicio servicio={s} />
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {esAdmin && lugares.length === 0 && (
        <p className="text-xs text-muted-foreground">
          ¿Atendés en más de un consultorio o clínica? Cargá los lugares en{" "}
          <Link href="/configuracion" className="underline">
            Configuración
          </Link>{" "}
          y cada servicio puede tener su precio según dónde se haga.
        </p>
      )}
    </div>
  );
}
