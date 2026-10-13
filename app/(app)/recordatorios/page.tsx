import Link from "next/link";
import { BellRing, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EstadoVacio } from "@/components/app/estado-vacio";
import { TarjetaTurno } from "@/components/turnos/tarjeta-turno";
import {
  obtenerConsultorio,
  obtenerProfesionales,
  obtenerRecordatoriosEnviados,
  obtenerRecordatoriosPendientes,
} from "@/lib/data";
import { fechaCorta } from "@/lib/fechas";
import { CANALES_RECORDATORIO } from "@/lib/labels";

export const metadata = { title: "Recordatorios" };

export default async function RecordatoriosPage() {
  const [consultorio, pendientes, enviados, profesionales] = await Promise.all([
    obtenerConsultorio(),
    obtenerRecordatoriosPendientes(),
    obtenerRecordatoriosEnviados(),
    obtenerProfesionales(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold tracking-tight">Recordatorios</h2>
        <p className="text-sm text-muted-foreground">
          Turnos de las próximas {consultorio.recordatorioHorasAntes} horas que todavía no
          tienen recordatorio. Abrí el mensaje en tu WhatsApp, mandalo y marcalo como
          enviado. La anticipación se cambia en{" "}
          <Link href="/configuracion" className="underline">
            Configuración
          </Link>
          .
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Para enviar ({pendientes.length})</CardTitle>
          <CardDescription>
            El mensaje lleva nombre, fecha, hora y profesional. Nunca información clínica.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {pendientes.length === 0 ? (
            <EstadoVacio
              icono={CheckCircle2}
              titulo="Estás al día"
              descripcion={`No hay turnos en las próximas ${consultorio.recordatorioHorasAntes} horas esperando recordatorio.`}
            />
          ) : (
            pendientes.map((t) => (
              <TarjetaTurno
                key={t.id}
                turno={t}
                profesionales={profesionales}
                zonaHoraria={consultorio.zonaHoraria}
                mostrarFecha
              />
            ))
          )}
        </CardContent>
      </Card>

      <Card className="py-0">
        <CardHeader className="pt-5">
          <CardTitle className="text-base">Enviados recientemente</CardTitle>
          <CardDescription>
            Si un turno se reprograma, su recordatorio anterior queda como
            «desactualizado» y el turno vuelve a la lista para enviar.
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-2">
          {enviados.length === 0 ? (
            <EstadoVacio
              icono={BellRing}
              titulo="Todavía no marcaste recordatorios"
              descripcion="Cuando marques uno como enviado, queda registrado acá con quién lo mandó y cuándo."
            />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Paciente</TableHead>
                    <TableHead>Turno</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead>Enviado</TableHead>
                    <TableHead className="pr-4">Por</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enviados.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="pl-4 font-medium">{r.pacienteNombre}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <span className="capitalize">{fechaCorta(r.fechaTurno)}</span> ·{" "}
                        {r.horaTurno}
                        {!r.vigente && (
                          <Badge variant="outline" className="ml-2 text-muted-foreground">
                            Desactualizado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {CANALES_RECORDATORIO[r.canal]}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {r.enviadoEn}
                      </TableCell>
                      <TableCell className="pr-4 text-muted-foreground">
                        {r.enviadoPor ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
