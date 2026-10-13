import Link from "next/link";
import { BellRing, CalendarCheck, CalendarDays, Clock, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { KpiCard } from "@/components/app/kpi-card";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { TarjetaTurno } from "@/components/turnos/tarjeta-turno";
import { NuevoTurno } from "@/components/turnos/formulario-turno";
import { NuevoPaciente } from "@/components/pacientes/formularios-paciente";
import {
  obtenerConsultorio,
  obtenerPacientes,
  obtenerProfesionales,
  obtenerProximosTurnos,
  obtenerRecordatoriosPendientes,
  obtenerTurnos,
} from "@/lib/data";
import { desfaseZona, fechaLarga, hoyEn, sumarDias } from "@/lib/fechas";

export const metadata = { title: "Inicio" };

export default async function InicioPage() {
  const consultorio = await obtenerConsultorio();
  const hoy = hoyEn(consultorio.zonaHoraria);
  const manana = sumarDias(hoy, 1);

  const [turnosHoy, proximos, recordatorios, pacientes, profesionales] =
    await Promise.all([
      obtenerTurnos({ desde: hoy, hasta: manana }),
      obtenerProximosTurnos({ desde: manana, limite: 5 }),
      obtenerRecordatoriosPendientes(),
      obtenerPacientes(),
      obtenerProfesionales(),
    ]);

  const activosHoy = turnosHoy.filter(
    (t) => t.estado === "pendiente" || t.estado === "confirmado",
  );
  const sinConfirmar = activosHoy.filter((t) => t.estado === "pendiente").length;
  const opcionesPacientes = pacientes.map((p) => ({
    id: p.id,
    nombre: p.nombre,
    telefono: p.telefono,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl font-semibold tracking-tight first-letter:uppercase">
            {fechaLarga(hoy)}
          </h2>
          <p className="text-sm text-muted-foreground">
            {consultorio.nombre} · Horarios en {consultorio.zonaHoraria} (
            {desfaseZona(consultorio.zonaHoraria)})
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <NuevoPaciente />
          <NuevoTurno
            pacientes={opcionesPacientes}
            profesionales={profesionales}
            duracionPorDefecto={consultorio.duracionTurnoMin}
            fechaPorDefecto={hoy}
            zonaHoraria={consultorio.zonaHoraria}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard etiqueta="Turnos de hoy" valor={String(activosHoy.length)} icono={CalendarCheck} />
        <KpiCard
          etiqueta="Sin confirmar hoy"
          valor={String(sinConfirmar)}
          icono={Clock}
          destacado={sinConfirmar > 0}
        />
        <Link href="/recordatorios" className="rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
          <KpiCard
            etiqueta="Recordatorios para enviar"
            valor={String(recordatorios.length)}
            icono={BellRing}
            destacado={recordatorios.length > 0}
          />
        </Link>
      </div>

      {pacientes.length === 0 ? (
        <Card>
          <EstadoVacio
            icono={Users}
            titulo="Empezá cargando tu primer paciente"
            descripcion="Con nombre y teléfono alcanza. Después le das un turno y le podés mandar el recordatorio por WhatsApp."
          >
            <NuevoPaciente textoDisparador="Agregar paciente" />
          </EstadoVacio>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Turnos de hoy</CardTitle>
              <CardDescription>
                Confirmá, reprogramá o mandá el recordatorio desde cada turno.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {turnosHoy.length === 0 ? (
                <EstadoVacio
                  icono={CalendarDays}
                  titulo="No hay turnos para hoy"
                  descripcion="Cuando agendes un turno para hoy, lo vas a ver acá con su estado."
                />
              ) : (
                turnosHoy.map((t) => (
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

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Próximos días</CardTitle>
              <CardDescription>Los siguientes turnos activos.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {proximos.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay turnos agendados después de hoy.
                </p>
              ) : (
                proximos.map((t) => (
                  <TarjetaTurno
                    key={t.id}
                    turno={t}
                    profesionales={profesionales}
                    zonaHoraria={consultorio.zonaHoraria}
                    compacta
                    mostrarFecha
                  />
                ))
              )}
              <Button variant="link" asChild className="self-start px-0">
                <Link href="/agenda?vista=semana">Ver la semana completa</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
