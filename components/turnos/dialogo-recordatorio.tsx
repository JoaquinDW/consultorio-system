"use client";

import { useState, useTransition } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { marcarRecordatorioEnviado } from "@/app/(app)/agenda/acciones";
import { linkWhatsapp } from "@/lib/recordatorios";
import type { CanalRecordatorio, Turno } from "@/lib/types";

/**
 * Flujo manual de recordatorio: el mensaje se abre en el WhatsApp de quien
 * atiende (wa.me) o se copia, y después se marca como enviado. No hay envío
 * automático: el sistema no puede saber si el mensaje salió, por eso el
 * "enviado" lo confirma una persona.
 */
export function DialogoRecordatorio({
  turno,
  abierto,
  alCambiarAbierto,
}: {
  turno: Turno;
  abierto: boolean;
  alCambiarAbierto: (abierto: boolean) => void;
}) {
  const [canal, setCanal] = useState<CanalRecordatorio | null>(null);
  const [pendiente, iniciarTransicion] = useTransition();
  const link = linkWhatsapp(turno.pacienteTelefono, turno.mensajeRecordatorio);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(turno.mensajeRecordatorio);
      setCanal((c) => c ?? "copiado");
      toast.success("Mensaje copiado.");
    } catch {
      toast.error("No pudimos copiar. Seleccioná el texto y copialo a mano.");
    }
  }

  function marcar() {
    iniciarTransicion(async () => {
      const resultado = await marcarRecordatorioEnviado(
        turno.id,
        canal ?? "whatsapp_manual",
      );
      if (resultado.ok) {
        toast.success("Recordatorio marcado como enviado.");
        alCambiarAbierto(false);
      } else {
        toast.error(resultado.error);
      }
    });
  }

  return (
    <Dialog
      open={abierto}
      onOpenChange={(nuevo) => {
        alCambiarAbierto(nuevo);
        if (!nuevo) setCanal(null);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Recordatorio para {turno.pacienteNombre}</DialogTitle>
          <DialogDescription>
            Abrilo en WhatsApp o copialo, mandalo desde tu teléfono y después
            marcalo como enviado.
          </DialogDescription>
        </DialogHeader>

        <Textarea
          readOnly
          value={turno.mensajeRecordatorio}
          rows={5}
          aria-label="Mensaje de recordatorio"
          onFocus={(e) => e.currentTarget.select()}
        />

        {!link && (
          <p className="text-xs text-warning">
            El teléfono {turno.pacienteTelefono} no tiene formato internacional
            completo, así que no lo podemos abrir en WhatsApp. Copiá el mensaje
            o corregí el teléfono del paciente (ej.: +54 9 351 555 0101).
          </p>
        )}

        {turno.recordatorioEnviadoEn && (
          <p className="flex items-center gap-1.5 text-xs text-success">
            <Check className="size-3.5" aria-hidden="true" />
            Ya se marcó como enviado ({turno.recordatorioEnviadoEn}).
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {link && (
            <Button variant="outline" asChild>
              <a
                href={link}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setCanal("whatsapp_manual")}
              >
                <MessageCircle aria-hidden="true" />
                Abrir en WhatsApp
              </a>
            </Button>
          )}
          <Button variant="outline" onClick={copiar}>
            <Copy aria-hidden="true" />
            Copiar mensaje
          </Button>
        </div>

        {!turno.recordatorioEnviadoEn && (
          <DialogFooter>
            <Button onClick={marcar} disabled={pendiente}>
              <Check aria-hidden="true" />
              {pendiente ? "Guardando…" : "Marcar como enviado"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
