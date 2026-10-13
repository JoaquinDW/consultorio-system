"use client";

import { type ComponentProps, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** Fila que agrupa campos en dos columnas en pantallas medianas o más. */
export function FilaCampos({ children }: { children: ReactNode }) {
  return <div className="grid gap-3 sm:grid-cols-2">{children}</div>;
}

function EnvoltorioCampo({
  nombre,
  etiqueta,
  requerido,
  children,
}: {
  nombre: string;
  etiqueta: string;
  requerido?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={nombre}>
        {etiqueta}
        {requerido && <span className="text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}

export function CampoTexto({
  nombre,
  etiqueta,
  requerido,
  ...props
}: {
  nombre: string;
  etiqueta: string;
  requerido?: boolean;
} & ComponentProps<typeof Input>) {
  return (
    <EnvoltorioCampo nombre={nombre} etiqueta={etiqueta} requerido={requerido}>
      <Input id={nombre} name={nombre} required={requerido} {...props} />
    </EnvoltorioCampo>
  );
}

export function CampoTextarea({
  nombre,
  etiqueta,
  requerido,
  ...props
}: {
  nombre: string;
  etiqueta: string;
  requerido?: boolean;
} & ComponentProps<typeof Textarea>) {
  return (
    <EnvoltorioCampo nombre={nombre} etiqueta={etiqueta} requerido={requerido}>
      <Textarea id={nombre} name={nombre} required={requerido} {...props} />
    </EnvoltorioCampo>
  );
}

export function CampoSelect({
  nombre,
  etiqueta,
  requerido,
  opciones,
  defaultValue,
  placeholder = "Elegí una opción",
}: {
  nombre: string;
  etiqueta: string;
  requerido?: boolean;
  opciones: { valor: string; etiqueta: string }[];
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <EnvoltorioCampo nombre={nombre} etiqueta={etiqueta} requerido={requerido}>
      <Select name={nombre} defaultValue={defaultValue} required={requerido}>
        <SelectTrigger id={nombre} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {opciones.map((o) => (
            <SelectItem key={o.valor} value={o.valor}>
              {o.etiqueta}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </EnvoltorioCampo>
  );
}
