import { Stethoscope } from "lucide-react";
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
import { obtenerConsultorio, obtenerProfesionales } from "@/lib/data";
import {
  CambiarActivoProfesional,
  FormularioConsultorio,
  NuevoProfesional,
} from "./formularios";

export const metadata = { title: "Configuración" };

export default async function ConfiguracionPage() {
  const [usuario, consultorio, profesionales] = await Promise.all([
    usuarioActual(),
    obtenerConsultorio(),
    obtenerProfesionales({ incluirInactivos: true }),
  ]);
  const esAdmin = usuario.rol === "administrador";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-heading text-2xl font-semibold tracking-tight">Configuración</h2>
        <p className="text-sm text-muted-foreground">
          {esAdmin
            ? "Datos del consultorio, zona horaria, recordatorios y profesionales."
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
      </div>
    </div>
  );
}
