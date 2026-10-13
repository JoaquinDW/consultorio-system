import Link from "next/link";
import { CalendarPlus, Search, SearchX, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  ArchivarPaciente,
  EditarPaciente,
  NuevoPaciente,
} from "@/components/pacientes/formularios-paciente";
import { NuevoTurno } from "@/components/turnos/formulario-turno";
import {
  contarPacientesActivos,
  obtenerConsultorio,
  obtenerPacientes,
  obtenerProfesionales,
} from "@/lib/data";
import { fechaCorta, hoyEn } from "@/lib/fechas";
import { cn } from "@/lib/utils";

export const metadata = { title: "Pacientes" };

function primero(valor: string | string[] | undefined): string {
  return (Array.isArray(valor) ? valor[0] : valor) ?? "";
}

export default async function PacientesPage({
  searchParams,
}: {
  searchParams: Promise<{ [clave: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const busqueda = primero(params.q).trim();
  const archivados = primero(params.archivados) === "1";

  const [pacientes, totalActivos, consultorio, profesionales] = await Promise.all([
    obtenerPacientes({ busqueda, archivados }),
    contarPacientesActivos(),
    obtenerConsultorio(),
    obtenerProfesionales(),
  ]);
  const hoy = hoyEn(consultorio.zonaHoraria);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-semibold tracking-tight">Pacientes</h2>
          <p className="text-sm text-muted-foreground">
            Solo datos de contacto: este sistema no guarda información clínica.
          </p>
        </div>
        <NuevoPaciente />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <form role="search" className="relative w-full sm:w-80">
          <Search
            className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            type="search"
            name="q"
            defaultValue={busqueda}
            placeholder="Buscar por nombre o teléfono"
            aria-label="Buscar paciente"
            className="pl-9"
          />
          {archivados && <input type="hidden" name="archivados" value="1" />}
        </form>
        <div className="flex rounded-md border p-0.5" role="group" aria-label="Mostrar">
          {[
            { etiqueta: "Activos", valor: false },
            { etiqueta: "Archivados", valor: true },
          ].map((op) => {
            const p = new URLSearchParams();
            if (busqueda) p.set("q", busqueda);
            if (op.valor) p.set("archivados", "1");
            const qs = p.toString();
            return (
              <Link
                key={op.etiqueta}
                href={qs ? `/pacientes?${qs}` : "/pacientes"}
                aria-current={archivados === op.valor ? "page" : undefined}
                className={cn(
                  "rounded-sm px-3 py-1 text-sm font-medium transition-colors",
                  archivados === op.valor
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {op.etiqueta}
              </Link>
            );
          })}
        </div>
      </div>

      <Card className="py-0">
        <CardContent className="px-0">
          {pacientes.length === 0 ? (
            busqueda ? (
              <EstadoVacio
                icono={SearchX}
                titulo={`No encontramos pacientes para «${busqueda}»`}
                descripcion="Probá con otra parte del nombre o con los últimos números del teléfono."
              />
            ) : archivados ? (
              <EstadoVacio
                icono={Users}
                titulo="No hay pacientes archivados"
                descripcion="Cuando archives un paciente deja de aparecer en la búsqueda y en los turnos nuevos, pero queda acá por si lo necesitás."
              />
            ) : (
              <EstadoVacio
                icono={Users}
                titulo="Todavía no cargaste pacientes"
                descripcion="Agregá el primero con su nombre y teléfono. Con eso ya le podés dar un turno y mandarle el recordatorio."
              >
                <NuevoPaciente textoDisparador="Agregar paciente" />
              </EstadoVacio>
            )
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Paciente</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead>Próximo turno</TableHead>
                    <TableHead className="pr-4 text-right">
                      <span className="sr-only">Acciones</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pacientes.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="pl-4">
                        <p className="font-medium">{p.nombre}</p>
                        {p.nota && (
                          <p className="max-w-64 truncate text-xs text-muted-foreground">
                            {p.nota}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {p.telefono}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {p.email ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap capitalize">
                        {p.proximoTurno
                          ? `${fechaCorta(p.proximoTurno.fecha)} · ${p.proximoTurno.hora}`
                          : <span className="text-muted-foreground normal-case">Sin turno</span>}
                      </TableCell>
                      <TableCell className="pr-4">
                        <div className="flex justify-end gap-1">
                          {!p.archivado && (
                            <NuevoTurno
                              // Turno para este paciente: no hace falta mandar la lista entera.
                              pacientes={[{ id: p.id, nombre: p.nombre, telefono: p.telefono }]}
                              profesionales={profesionales}
                              duracionPorDefecto={consultorio.duracionTurnoMin}
                              fechaPorDefecto={hoy}
                              zonaHoraria={consultorio.zonaHoraria}
                              pacienteId={p.id}
                              disparador={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  aria-label={`Nuevo turno para ${p.nombre}`}
                                  title="Nuevo turno"
                                >
                                  <CalendarPlus />
                                </Button>
                              }
                            />
                          )}
                          <EditarPaciente paciente={p} />
                          <ArchivarPaciente paciente={p} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {!archivados && totalActivos > 0 && (
        <p className="text-xs text-muted-foreground">
          {pacientes.length} de {totalActivos} pacientes activos.
        </p>
      )}
    </div>
  );
}
