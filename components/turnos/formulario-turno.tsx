"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { FormularioDialogo } from "@/components/app/formulario-dialogo";
import {
  CampoSelect,
  CampoTextarea,
  CampoTexto,
  FilaCampos,
} from "@/components/app/campos-formulario";
import { crearTurno, reprogramarTurno } from "@/app/(app)/agenda/acciones";
import { DURACIONES_TURNO, SIN_PROFESIONAL, SIN_SERVICIO } from "@/lib/labels";
import { etiquetaServicio } from "@/lib/servicios";
import type { Profesional, Servicio, Turno } from "@/lib/types";

export interface OpcionPaciente {
  id: string;
  nombre: string;
  telefono: string;
}

function opcionesDuracion(actual: number) {
  const valores = DURACIONES_TURNO.includes(actual)
    ? DURACIONES_TURNO
    : [...DURACIONES_TURNO, actual].sort((a, b) => a - b);
  return valores.map((m) => ({ valor: String(m), etiqueta: `${m} min` }));
}

function CampoProfesional({
  profesionales,
  defaultValue,
  actual,
}: {
  profesionales: Profesional[];
  defaultValue?: string | null;
  /** Profesional que ya tiene el turno, aunque ahora esté inactivo. */
  actual?: { id: string; nombre: string } | null;
}) {
  if (actual && !profesionales.some((p) => p.id === actual.id)) {
    profesionales = [
      ...profesionales,
      { id: actual.id, nombre: actual.nombre, especialidad: null, activo: false },
    ];
  }
  if (profesionales.length === 0) return null;
  // Con un solo profesional, viene elegido: es la agenda del consultorio.
  const porDefecto =
    defaultValue ??
    (profesionales.length === 1 ? profesionales[0].id : SIN_PROFESIONAL);
  return (
    <CampoSelect
      nombre="profesional_id"
      etiqueta="Profesional"
      defaultValue={porDefecto}
      opciones={[
        { valor: SIN_PROFESIONAL, etiqueta: "Sin asignar" },
        ...profesionales.map((p) => ({
          valor: p.id,
          etiqueta: p.especialidad ? `${p.nombre} · ${p.especialidad}` : p.nombre,
        })),
      ]}
    />
  );
}

export function NuevoTurno({
  pacientes,
  profesionales,
  servicios = [],
  duracionPorDefecto,
  fechaPorDefecto,
  zonaHoraria,
  pacienteId,
  disparador,
}: {
  pacientes: OpcionPaciente[];
  profesionales: Profesional[];
  /** Servicios activos: elegir uno completa la duración y el profesional. */
  servicios?: Servicio[];
  duracionPorDefecto: number;
  fechaPorDefecto: string;
  zonaHoraria: string;
  pacienteId?: string;
  disparador?: ReactNode;
}) {
  const [servicioId, setServicioId] = useState(SIN_SERVICIO);
  const servicio = servicios.find((s) => s.id === servicioId);

  return (
    <FormularioDialogo
      titulo="Nuevo turno"
      descripcion={`Fecha y hora en la zona del consultorio (${zonaHoraria}).`}
      textoDisparador="Nuevo turno"
      textoGuardar="Agendar turno"
      disparador={disparador}
      accion={crearTurno}
      alGuardar={() => toast.success("Turno agendado.")}
    >
      {pacientes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no cargaste pacientes. Andá a{" "}
          <Link href="/pacientes" className="font-medium text-foreground underline">
            Pacientes
          </Link>{" "}
          y agregá el primero para poder darle un turno.
        </p>
      ) : (
        <>
          <CampoSelect
            nombre="paciente_id"
            etiqueta="Paciente"
            requerido
            defaultValue={pacienteId}
            placeholder="Elegí un paciente"
            opciones={pacientes.map((p) => ({
              valor: p.id,
              etiqueta: `${p.nombre} · ${p.telefono}`,
            }))}
          />
          {servicios.length > 0 && (
            <CampoSelect
              nombre="servicio_id"
              etiqueta="Servicio"
              // El diálogo se desmonta al cerrar: arranca con el último elegido.
              defaultValue={servicioId}
              alCambiar={setServicioId}
              opciones={[
                { valor: SIN_SERVICIO, etiqueta: "Sin especificar" },
                ...servicios.map((s) => ({ valor: s.id, etiqueta: etiquetaServicio(s) })),
              ]}
            />
          )}
          <FilaCampos>
            <CampoTexto
              nombre="fecha"
              etiqueta="Fecha"
              type="date"
              requerido
              defaultValue={fechaPorDefecto}
            />
            <CampoTexto nombre="hora" etiqueta="Hora" type="time" step={300} requerido />
          </FilaCampos>
          {/* Al elegir un servicio se remontan con su duración y su profesional
              (se pueden cambiar igual). */}
          <FilaCampos key={servicioId}>
            <CampoSelect
              nombre="duracion"
              etiqueta="Duración"
              requerido
              defaultValue={String(servicio?.duracionMin ?? duracionPorDefecto)}
              opciones={opcionesDuracion(servicio?.duracionMin ?? duracionPorDefecto)}
            />
            <CampoProfesional
              profesionales={profesionales}
              defaultValue={servicio?.profesionalId ?? undefined}
            />
          </FilaCampos>
          <CampoTextarea
            nombre="nota"
            etiqueta="Nota administrativa"
            maxLength={500}
            placeholder="Ej.: viene con acompañante. Sin datos clínicos."
          />
        </>
      )}
    </FormularioDialogo>
  );
}

export function ReprogramarTurno({
  turno,
  profesionales,
  zonaHoraria,
  abierto,
  alCambiarAbierto,
}: {
  turno: Turno;
  profesionales: Profesional[];
  zonaHoraria: string;
  abierto: boolean;
  alCambiarAbierto: (abierto: boolean) => void;
}) {
  return (
    <FormularioDialogo
      titulo={`Reprogramar turno de ${turno.pacienteNombre}`}
      descripcion={`El turno vuelve a "pendiente" hasta que el paciente confirme. Zona: ${zonaHoraria}.`}
      textoGuardar="Reprogramar"
      disparador={null}
      abierto={abierto}
      alCambiarAbierto={alCambiarAbierto}
      accion={reprogramarTurno}
      alGuardar={() => toast.success("Turno reprogramado.")}
    >
      <input type="hidden" name="id" value={turno.id} />
      <FilaCampos>
        <CampoTexto
          nombre="fecha"
          etiqueta="Fecha"
          type="date"
          requerido
          defaultValue={turno.fecha}
        />
        <CampoTexto
          nombre="hora"
          etiqueta="Hora"
          type="time"
          step={300}
          requerido
          defaultValue={turno.hora}
        />
      </FilaCampos>
      <FilaCampos>
        <CampoSelect
          nombre="duracion"
          etiqueta="Duración"
          requerido
          defaultValue={String(turno.duracionMin)}
          opciones={opcionesDuracion(turno.duracionMin)}
        />
        <CampoProfesional
          profesionales={profesionales}
          defaultValue={turno.profesionalId ?? SIN_PROFESIONAL}
          actual={
            turno.profesionalId && turno.profesionalNombre
              ? { id: turno.profesionalId, nombre: turno.profesionalNombre }
              : null
          }
        />
      </FilaCampos>
    </FormularioDialogo>
  );
}
