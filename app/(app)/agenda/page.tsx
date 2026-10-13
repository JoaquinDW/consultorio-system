import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { TarjetaTurno } from "@/components/turnos/tarjeta-turno";
import { NuevoTurno } from "@/components/turnos/formulario-turno";
import {
  obtenerConsultorio,
  obtenerPacientes,
  obtenerProfesionales,
  obtenerTurnos,
} from "@/lib/data";
import {
  desfaseZona,
  esFechaValida,
  fechaCorta,
  fechaLarga,
  hoyEn,
  inicioDeSemana,
  rangoSemana,
  sumarDias,
} from "@/lib/fechas";
import { cn } from "@/lib/utils";
import type { Turno } from "@/lib/types";

export const metadata = { title: "Agenda" };

type Vista = "dia" | "semana";

function primero(valor: string | string[] | undefined): string | undefined {
  return Array.isArray(valor) ? valor[0] : valor;
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ [clave: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const consultorio = await obtenerConsultorio();
  const hoy = hoyEn(consultorio.zonaHoraria);

  const vista: Vista = primero(params.vista) === "semana" ? "semana" : "dia";
  const fechaParam = primero(params.fecha);
  const fecha = fechaParam && esFechaValida(fechaParam) ? fechaParam : hoy;
  const profesionalParam = primero(params.profesional) ?? null;

  const [profesionales, pacientes] = await Promise.all([
    obtenerProfesionales(),
    obtenerPacientes(),
  ]);
  const profesionalId =
    profesionalParam && profesionales.some((p) => p.id === profesionalParam)
      ? profesionalParam
      : null;

  const desde = vista === "dia" ? fecha : inicioDeSemana(fecha);
  const dias = vista === "dia" ? 1 : 7;
  const turnos = await obtenerTurnos({
    desde,
    hasta: sumarDias(desde, dias),
    profesionalId,
  });

  function href(cambios: { vista?: Vista; fecha?: string; profesional?: string | null }) {
    const p = new URLSearchParams();
    const v = cambios.vista ?? vista;
    if (v === "semana") p.set("vista", "semana");
    const f = cambios.fecha ?? fecha;
    if (f !== hoy) p.set("fecha", f);
    const prof = cambios.profesional === undefined ? profesionalId : cambios.profesional;
    if (prof) p.set("profesional", prof);
    const qs = p.toString();
    return qs ? `/agenda?${qs}` : "/agenda";
  }

  const porDia = new Map<string, Turno[]>();
  for (let i = 0; i < dias; i++) porDia.set(sumarDias(desde, i), []);
  for (const t of turnos) porDia.get(t.fecha)?.push(t);

  const titulo = vista === "dia" ? fechaLarga(fecha) : `Semana del ${rangoSemana(desde)}`;
  const activos = turnos.filter(
    (t) => t.estado === "pendiente" || t.estado === "confirmado",
  ).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-semibold tracking-tight first-letter:uppercase">
            {titulo}
          </h2>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Globe className="size-3.5" aria-hidden="true" />
            Horarios en {consultorio.zonaHoraria} ({desfaseZona(consultorio.zonaHoraria)})
            · {activos} {activos === 1 ? "turno activo" : "turnos activos"}
          </p>
        </div>
        <NuevoTurno
          pacientes={pacientes.map((p) => ({ id: p.id, nombre: p.nombre, telefono: p.telefono }))}
          profesionales={profesionales}
          duracionPorDefecto={consultorio.duracionTurnoMin}
          fechaPorDefecto={fecha < hoy ? hoy : fecha}
          zonaHoraria={consultorio.zonaHoraria}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" asChild>
            <Link
              href={href({ fecha: sumarDias(fecha, -dias) })}
              aria-label={vista === "dia" ? "Día anterior" : "Semana anterior"}
            >
              <ChevronLeft />
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={href({ fecha: hoy })}>Hoy</Link>
          </Button>
          <Button variant="outline" size="icon" asChild>
            <Link
              href={href({ fecha: sumarDias(fecha, dias) })}
              aria-label={vista === "dia" ? "Día siguiente" : "Semana siguiente"}
            >
              <ChevronRight />
            </Link>
          </Button>
        </div>

        <div className="flex rounded-md border p-0.5" role="group" aria-label="Vista">
          {(["dia", "semana"] as const).map((v) => (
            <Link
              key={v}
              href={href({ vista: v })}
              aria-current={vista === v ? "page" : undefined}
              className={cn(
                "rounded-sm px-3 py-1 text-sm font-medium transition-colors",
                vista === v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v === "dia" ? "Día" : "Semana"}
            </Link>
          ))}
        </div>

        {profesionales.length > 1 && (
          <div className="flex flex-wrap gap-1" role="group" aria-label="Profesional">
            {[{ id: null, nombre: "Todos" }, ...profesionales].map((p) => (
              <Link
                key={p.id ?? "todos"}
                href={href({ profesional: p.id })}
                aria-current={profesionalId === p.id ? "page" : undefined}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  profesionalId === p.id
                    ? "border-primary bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {p.nombre}
              </Link>
            ))}
          </div>
        )}
      </div>

      {vista === "dia" ? (
        <Card>
          <CardContent className="flex flex-col gap-2">
            {turnos.length === 0 ? (
              <EstadoVacio
                icono={CalendarDays}
                titulo="No hay turnos este día"
                descripcion={
                  pacientes.length === 0
                    ? "Primero cargá un paciente en Pacientes y después agendale un turno con «Nuevo turno»."
                    : "Usá «Nuevo turno» para agendar uno, o mirá otro día con las flechas."
                }
              />
            ) : (
              turnos.map((t) => (
                <TarjetaTurno
                  key={t.id}
                  turno={t}
                  profesionales={profesionales}
                  zonaHoraria={consultorio.zonaHoraria}
                />
              ))
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          {[...porDia.entries()].map(([dia, turnosDia]) => (
            <div
              key={dia}
              className={cn(
                "flex flex-col gap-2 rounded-lg border bg-muted/40 p-2",
                dia === hoy && "border-primary/40 bg-primary/5",
              )}
            >
              <Link
                href={href({ vista: "dia", fecha: dia })}
                className="flex items-baseline justify-between px-1 text-sm font-semibold capitalize hover:underline"
              >
                {fechaCorta(dia)}
                {dia === hoy && (
                  <span className="text-xs font-medium text-primary normal-case">Hoy</span>
                )}
              </Link>
              {turnosDia.length === 0 ? (
                <p className="px-1 pb-2 text-xs text-muted-foreground">Sin turnos</p>
              ) : (
                turnosDia.map((t) => (
                  <TarjetaTurno
                    key={t.id}
                    turno={t}
                    profesionales={profesionales}
                    zonaHoraria={consultorio.zonaHoraria}
                    compacta
                  />
                ))
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
