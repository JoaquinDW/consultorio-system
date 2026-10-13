import Link from "next/link";
import { Clock, MapPin, Stethoscope } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { usuarioActual } from "@/lib/auth";
import {
  obtenerConsultorio,
  obtenerHorarios,
  obtenerLugares,
  obtenerProfesionales,
} from "@/lib/data";
import { DIAS_SEMANA } from "@/lib/horarios";
import type { FranjaHorario } from "@/lib/types";
import {
  obtenerAgendarTurnosBot,
  obtenerEstadoConexionWa,
  obtenerRecordatoriosAutomaticos,
} from "@/lib/data-whatsapp";
import { ESTADOS_CONEXION_WA } from "@/lib/labels";
import {
  CambiarActivoLugar,
  CambiarActivoProfesional,
  EliminarHorario,
  FormularioConsultorio,
  NuevoHorario,
  NuevoLugar,
  NuevoProfesional,
  ToggleAgendarTurnosBot,
  ToggleRecordatoriosAutomaticos,
} from "./formularios";

export const metadata = { title: "Configuración" };

export default async function ConfiguracionPage() {
  const [usuario, consultorio, profesionales, lugares, horarios, estadoWa, automaticos, agendaBot] = await Promise.all([
    usuarioActual(),
    obtenerConsultorio(),
    obtenerProfesionales({ incluirInactivos: true }),
    obtenerLugares({ incluirInactivos: true }),
    obtenerHorarios(),
    obtenerEstadoConexionWa(),
    obtenerRecordatoriosAutomaticos(),
    obtenerAgendarTurnosBot(),
  ]);
  const etiquetaWa = ESTADOS_CONEXION_WA[estadoWa.estado];
  const esAdmin = usuario.rol === "administrador";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold tracking-tight">Configuración</h2>
        <p className="text-sm text-muted-foreground">
          {esAdmin
            ? "Datos del consultorio, horarios de atención, recordatorios, profesionales y lugares."
            : "Solo quien administra el consultorio puede cambiar estos datos."}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Consultorio</CardTitle>
            <CardDescription>
              El nombre aparece en el mensaje de recordatorio.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormularioConsultorio consultorio={consultorio} editable={esAdmin} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base">Profesionales</CardTitle>
              <CardDescription>
                Opcional. Sin profesionales, el consultorio tiene una sola agenda.
              </CardDescription>
            </div>
            {esAdmin && <NuevoProfesional />}
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {profesionales.length === 0 ? (
              <EstadoVacio
                icono={Stethoscope}
                titulo="No hay profesionales cargados"
                descripcion="Si atienden varias personas, cargalas para que cada una tenga su agenda y su nombre salga en el recordatorio."
              />
            ) : (
              profesionales.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{p.nombre}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.especialidad ?? "Sin especialidad"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!p.activo && (
                      <Badge variant="outline" className="text-muted-foreground">
                        Inactivo
                      </Badge>
                    )}
                    {esAdmin && <CambiarActivoProfesional profesional={p} />}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base">Horarios de atención</CardTitle>
              <CardDescription>
                Fuera de estos horarios la agenda no deja dar ni reprogramar
                turnos. Un profesional con horario propio atiende solo en ese;
                el resto usa el general.
              </CardDescription>
            </div>
            {esAdmin && (
              <NuevoHorario
                profesionales={profesionales.filter((p) => p.activo)}
                lugares={lugares.filter((l) => l.activo)}
              />
            )}
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {horarios.length === 0 ? (
              <EstadoVacio
                icono={Clock}
                titulo="No hay horarios cargados"
                descripcion="Mientras no cargues ninguno, se pueden dar turnos a cualquier hora y cualquier día."
              />
            ) : (
              agruparHorarios(horarios).map((grupo) => (
                <div key={grupo.clave} className="rounded-lg border p-3">
                  <p className="mb-2 font-medium">{grupo.titulo}</p>
                  <div className="flex flex-col gap-1">
                    {DIAS_SEMANA.map((d) => {
                      const delDia = grupo.franjas.filter((f) => f.diaSemana === d.valor);
                      return (
                        <div key={d.valor} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                          <span className="w-20 shrink-0 text-muted-foreground">{d.etiqueta}</span>
                          {delDia.length === 0 ? (
                            <span className="text-muted-foreground">No atiende</span>
                          ) : (
                            delDia.map((f) => (
                              <span
                                key={f.id}
                                className="flex items-center gap-0.5 rounded-md bg-muted py-0.5 pr-0.5 pl-2 tabular-nums"
                              >
                                {f.desde}–{f.hasta}
                                {f.lugarNombre && (
                                  <span className="text-xs text-muted-foreground">
                                    &nbsp;· {f.lugarNombre}
                                  </span>
                                )}
                                {esAdmin ? <EliminarHorario franja={f} /> : <span className="w-1.5" />}
                              </span>
                            ))
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base">Lugares</CardTitle>
              <CardDescription>
                Opcional. Si atienden en más de un consultorio o clínica, cada{" "}
                <Link href="/servicios" className="underline">
                  servicio
                </Link>{" "}
                puede tener su lugar, su precio y su profesional.
              </CardDescription>
            </div>
            {esAdmin && <NuevoLugar />}
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {lugares.length === 0 ? (
              <div className="sm:col-span-2">
                <EstadoVacio
                  icono={MapPin}
                  titulo="No hay lugares cargados"
                  descripcion="Con un solo lugar no hace falta: los servicios valen para todo el consultorio."
                />
              </div>
            ) : (
              lugares.map((l) => (
                <div
                  key={l.id}
                  className="flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{l.nombre}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {l.direccion ?? "Sin dirección"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!l.activo && (
                      <Badge variant="outline" className="text-muted-foreground">
                        Inactivo
                      </Badge>
                    )}
                    {esAdmin && <CambiarActivoLugar lugar={l} />}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <CardTitle className="text-base">WhatsApp</CardTitle>
              <CardDescription>
                El bot manda recordatorios, registra confirmaciones, toma
                pedidos de turno y te avisa cuando un paciente pide cambiar
                uno.{" "}
                <Link href="/whatsapp" className="underline">
                  Ver conversaciones
                </Link>
              </CardDescription>
            </div>
            <Badge variant="outline" className={etiquetaWa.className}>
              {etiquetaWa.etiqueta}
              {estadoWa.telefono && ` · +${estadoWa.telefono}`}
            </Badge>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <ToggleRecordatoriosAutomaticos activo={automaticos} editable={esAdmin} />
            <ToggleAgendarTurnosBot activo={agendaBot} editable={esAdmin} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** General primero, después cada profesional con horario propio. */
function agruparHorarios(horarios: FranjaHorario[]) {
  const grupos = new Map<string, { clave: string; titulo: string; franjas: FranjaHorario[] }>();
  for (const f of horarios) {
    const clave = f.profesionalId ?? "general";
    if (!grupos.has(clave)) {
      grupos.set(clave, {
        clave,
        titulo: f.profesionalNombre ?? "Horario general del consultorio",
        franjas: [],
      });
    }
    grupos.get(clave)!.franjas.push(f);
  }
  return [...grupos.values()].sort((a, b) =>
    a.clave === "general" ? -1 : b.clave === "general" ? 1 : a.titulo.localeCompare(b.titulo),
  );
}
