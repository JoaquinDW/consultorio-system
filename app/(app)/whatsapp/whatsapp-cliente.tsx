"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BellRing,
  Bot,
  CheckCheck,
  Contact,
  Loader2,
  MessageCircle,
  Send,
  Trash2,
  Unplug,
  User,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { formatearHora, iniciales, tiempoRelativo } from "@/lib/format";
import { ESTADOS_CONEXION_WA, MODOS_WA } from "@/lib/labels";
import { cn } from "@/lib/utils";
import type {
  FichaPacienteWa,
  ModoWa,
  WaConversacion,
  WaEstadoConexion,
  WaMensaje,
} from "@/lib/types";
import { toast } from "sonner";
import {
  cambiarModoConversacion,
  desconectarWhatsapp,
  eliminarConversacionWa,
  enviarMensajeHumano,
  marcarConversacionAtendida,
} from "./acciones";
import { FichaPaciente } from "./ficha-paciente";

interface WhatsappClienteProps {
  estadoInicial: WaEstadoConexion;
  conversacionesIniciales: WaConversacion[];
}

export function WhatsappCliente({
  estadoInicial,
  conversacionesIniciales,
}: WhatsappClienteProps) {
  const [estado, setEstado] = useState(estadoInicial);
  const [conversaciones, setConversaciones] = useState(conversacionesIniciales);
  const [seleccionadaId, setSeleccionadaId] = useState<string | null>(null);
  const [mensajes, setMensajes] = useState<WaMensaje[]>([]);
  const [paciente, setPaciente] = useState<FichaPacienteWa | null>(null);
  // Solo manda por debajo de xl, donde la ficha y el hilo comparten lugar.
  const [fichaAbierta, setFichaAbierta] = useState(false);
  const [borrador, setBorrador] = useState("");
  const [enviando, startEnviando] = useTransition();
  const [esperaLarga, setEsperaLarga] = useState(false);
  const [sesionVencida, setSesionVencida] = useState(false);
  const refMensajes = useRef<HTMLDivElement>(null);

  const seleccionada = conversaciones.find((c) => c.id === seleccionadaId);

  // Polling cada 2s con setTimeout encadenado (no setInterval: si un tick
  // tarda más de 2s no se apilan requests). El primer tick corre al toque.
  useEffect(() => {
    let activo = true;
    let timer: ReturnType<typeof setTimeout>;

    // La sesión venció: cortar el polling y avisar. Sin esto los 401 se comían
    // en silencio y el panel parecía "colgado" en vez de deslogueado.
    let seguir = true;
    function sesionCaida() {
      seguir = false;
      if (activo) setSesionVencida(true);
    }

    async function tick() {
      try {
        const resEstado = await fetch("/api/whatsapp/estado");
        if (!activo) return;
        if (resEstado.status === 401) return sesionCaida();
        if (!resEstado.ok) return;
        const nuevoEstado = (await resEstado.json()) as WaEstadoConexion;
        if (!activo) return;
        setEstado(nuevoEstado);
        setSesionVencida(false);

        if (nuevoEstado.estado === "conectado") {
          const [resConvs, resMensajes] = await Promise.all([
            fetch("/api/whatsapp/conversaciones"),
            seleccionadaId
              ? fetch(`/api/whatsapp/conversaciones/${seleccionadaId}/mensajes`)
              : null,
          ]);
          if (!activo) return;
          if (resConvs.status === 401 || resMensajes?.status === 401) {
            return sesionCaida();
          }
          if (resConvs.ok) {
            const data = (await resConvs.json()) as {
              conversaciones: WaConversacion[];
            };
            if (activo) setConversaciones(data.conversaciones);
          }
          if (resMensajes) {
            if (resMensajes.status === 404) {
              // La borraron desde otra pestaña.
              if (activo) setSeleccionadaId(null);
            } else if (resMensajes.ok) {
              const data = (await resMensajes.json()) as {
                mensajes: WaMensaje[];
                paciente: FichaPacienteWa | null;
              };
              if (activo) {
                setMensajes(data.mensajes);
                setPaciente(data.paciente);
              }
            }
          }
        }
      } catch {
        // Red caída: se reintenta en el próximo tick sin romper la UI.
      } finally {
        if (activo && seguir) timer = setTimeout(tick, 2000);
      }
    }

    timer = setTimeout(tick, 0);
    return () => {
      activo = false;
      clearTimeout(timer);
    };
  }, [seleccionadaId]);

  // Si el bot no da señales (desconectado sin QR) por más de 10s, sugerir
  // levantar el servicio. El flag queda prendido; solo se muestra mientras
  // el estado siga en desconectado sin QR.
  useEffect(() => {
    if (estado.estado !== "desconectado" || estado.qr) return;
    const timer = setTimeout(() => setEsperaLarga(true), 10_000);
    return () => clearTimeout(timer);
  }, [estado.estado, estado.qr]);

  // Auto-scroll al fondo cuando llegan mensajes o cambia el hilo.
  useEffect(() => {
    const nodo = refMensajes.current;
    if (nodo) nodo.scrollTop = nodo.scrollHeight;
  }, [mensajes.length, seleccionadaId]);

  function seleccionarConversacion(id: string) {
    setSeleccionadaId(id);
    setMensajes([]);
    setPaciente(null);
    setFichaAbierta(false);
  }

  function manejarEnviar() {
    const texto = borrador.trim();
    if (!texto || !seleccionada || enviando) return;
    setBorrador("");
    const conversacionId = seleccionada.id;
    startEnviando(async () => {
      // Optimista: aparece al toque; el polling lo reemplaza por la fila real.
      const optimista: WaMensaje = {
        id: `local-${Date.now()}`,
        rol: "humano",
        contenido: texto,
        creadoEn: new Date().toISOString(),
      };
      setMensajes((prev) => [...prev, optimista]);
      const resultado = await enviarMensajeHumano(conversacionId, texto);
      if (!resultado.ok) {
        setMensajes((prev) => prev.filter((m) => m.id !== optimista.id));
        setBorrador(texto);
        toast.error(resultado.error ?? "No pudimos enviar el mensaje.");
      }
    });
  }

  function manejarModo(modo: ModoWa) {
    if (!seleccionada || seleccionada.modo === modo) return;
    const conversacionId = seleccionada.id;
    // Optimista: el polling restaura la verdad si la acción falla.
    setConversaciones((prev) =>
      prev.map((c) => (c.id === conversacionId ? { ...c, modo } : c)),
    );
    void cambiarModoConversacion(conversacionId, modo).then((resultado) => {
      if (!resultado.ok) {
        toast.error(resultado.error ?? "No pudimos cambiar el modo.");
      }
    });
  }

  async function manejarAtendida() {
    if (!seleccionada) return;
    const conversacionId = seleccionada.id;
    setConversaciones((prev) =>
      prev.map((c) => (c.id === conversacionId ? { ...c, requiereAtencion: false } : c)),
    );
    const resultado = await marcarConversacionAtendida(conversacionId);
    if (!resultado.ok) toast.error(resultado.error ?? "No pudimos actualizar la conversación.");
  }

  async function manejarBorrar() {
    if (!seleccionada) return;
    const conversacionId = seleccionada.id;
    const resultado = await eliminarConversacionWa(conversacionId);
    if (resultado.ok) {
      setConversaciones((prev) => prev.filter((c) => c.id !== conversacionId));
      setSeleccionadaId(null);
      toast.success("Conversación borrada");
    } else {
      toast.error(resultado.error ?? "No pudimos borrar la conversación.");
    }
  }

  async function manejarDesconectar() {
    const resultado = await desconectarWhatsapp();
    if (resultado.ok) {
      toast.success("Cerrando la sesión de WhatsApp…", {
        description: "En unos segundos aparece un QR nuevo para vincular.",
      });
    } else {
      toast.error(resultado.error ?? "No pudimos desconectar.");
    }
  }

  // Cartel de sesión vencida: mientras esté, lo que se ve en pantalla quedó
  // congelado en el último dato bueno.
  const avisoSesion = sesionVencida ? (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-sm text-warning"
    >
      <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
      <span>
        Tu sesión venció y el panel dejó de actualizarse. Lo que ves puede estar
        desactualizado.
      </span>
      <Button
        variant="outline"
        size="sm"
        className="ml-auto"
        onClick={() => {
          // A /login directo: recargar no alcanza, la cookie vencida sigue
          // puesta y el proxy (Edge) no puede saber que ya no sirve.
          window.location.href = "/login";
        }}
      >
        Volver a entrar
      </Button>
    </div>
  ) : null;

  // -------------------------------------------------------------------------
  // Pantalla de conexión (sin sesión de WhatsApp vinculada)
  // -------------------------------------------------------------------------
  if (estado.estado !== "conectado") {
    const etiquetaEstado = ESTADOS_CONEXION_WA[estado.estado];
    const botSinSenales =
      estado.estado === "desconectado" && !estado.qr && esperaLarga;

    return (
      <div className="flex min-h-[70dvh] flex-col items-center justify-center gap-4">
        {avisoSesion}
        <Card className="flex w-full max-w-md flex-col items-center gap-4 p-8 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-success/10">
            <MessageCircle className="size-6 text-success" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-heading text-xl font-semibold tracking-tight">
              Conectá tu WhatsApp
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Vinculá el número del consultorio para mandar recordatorios,
              recibir confirmaciones y atender los mensajes desde acá.
            </p>
          </div>
          <Badge variant="outline" className={etiquetaEstado.className}>
            {etiquetaEstado.etiqueta}
          </Badge>

          {estado.qr ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- data-url generada por el bot, next/image no aplica */}
              <img
                src={estado.qr}
                alt="Código QR para vincular WhatsApp"
                className="size-72 rounded-lg border bg-white p-2"
              />
              <p className="text-sm text-muted-foreground">
                En tu teléfono abrí <strong>WhatsApp</strong> → Configuración →{" "}
                <strong>Dispositivos vinculados</strong> →{" "}
                <strong>Vincular un dispositivo</strong> y escaneá el código.
              </p>
            </>
          ) : (
            <>
              <Loader2
                className="size-8 animate-spin text-muted-foreground"
                aria-hidden="true"
              />
              <p className="text-sm text-muted-foreground">
                {estado.estado === "conectando"
                  ? "Conectando con WhatsApp…"
                  : "Esperando al servicio del bot…"}
              </p>
              {botSinSenales && (
                <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning">
                  El bot no da señales. Levantalo con{" "}
                  <code className="font-mono">docker compose up -d --build bot</code>{" "}
                  y revisá sus logs si esto no avanza.
                </p>
              )}
            </>
          )}
        </Card>
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // Dashboard (conectado)
  // -------------------------------------------------------------------------
  return (
    // `data-ancho-completo`: el chat usa todo el ancho de la ventana, sin el
    // max-w-7xl que el shell le pone al resto de las secciones.
    <div
      data-ancho-completo
      className="flex h-[calc(100dvh-8.5rem)] min-h-112 flex-col gap-4"
    >
      {avisoSesion}
      {/* Encabezado: estado de la conexión + desconectar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className={ESTADOS_CONEXION_WA.conectado.className}>
            {ESTADOS_CONEXION_WA.conectado.etiqueta}
          </Badge>
          {estado.telefono && (
            <span className="text-sm text-muted-foreground">
              +{estado.telefono}
            </span>
          )}
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Unplug className="size-4" aria-hidden="true" />
              Desconectar
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Desconectar WhatsApp?</AlertDialogTitle>
              <AlertDialogDescription>
                Se cierra la sesión del número vinculado y el bot deja de
                responder. Para volver a conectar vas a tener que escanear un
                QR nuevo.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={manejarDesconectar}>
                Desconectar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-0 lg:flex-row lg:gap-4">
        {/* Lista de conversaciones */}
        <Card
          className={cn(
            "flex w-full flex-col overflow-hidden py-0 lg:w-80 lg:shrink-0 2xl:w-96",
            seleccionadaId && "hidden lg:flex",
          )}
        >
          <div className="border-b px-4 py-3">
            <h2 className="font-heading text-base font-semibold">
              Conversaciones
            </h2>
            <p className="text-xs text-muted-foreground">
              El bot responde solo las que están en modo Bot
            </p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversaciones.length === 0 && (
              <p className="p-4 text-sm text-muted-foreground">
                Todavía no hay conversaciones. Cuando un paciente le escriba al
                número, o le mandes un recordatorio por el bot, aparecen acá.
              </p>
            )}
            {conversaciones.map((c) => {
              const activa = c.id === seleccionadaId;
              const modo = MODOS_WA[c.modo];
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => seleccionarConversacion(c.id)}
                  aria-current={activa ? "true" : undefined}
                  className={cn(
                    "flex w-full items-start gap-3 border-b px-4 py-3 text-left transition-colors duration-150 hover:bg-muted/60",
                    activa && "bg-muted",
                  )}
                >
                  <Avatar className="size-9 shrink-0">
                    <AvatarFallback className="bg-secondary text-xs font-semibold">
                      {iniciales(c.pacienteNombre ?? c.nombre ?? c.telefono)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium">
                        {c.pacienteNombre ?? c.nombre ?? c.telefono}
                      </span>
                      {c.requiereAtencion && (
                        <span
                          className="size-2 shrink-0 rounded-full bg-destructive"
                          title="Requiere atención"
                          aria-label="Requiere atención"
                        />
                      )}
                      {c.ultimoMensajeEn && (
                        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                          {tiempoRelativo(c.ultimoMensajeEn)}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 flex items-center gap-2">
                      <span className="truncate text-xs text-muted-foreground">
                        {c.ultimoMensaje ?? "Sin mensajes"}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "ml-auto shrink-0 px-1.5 py-0 text-[10px]",
                          modo.className,
                        )}
                      >
                        {modo.etiqueta}
                      </Badge>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </Card>

        {/* Hilo */}
        <Card
          className={cn(
            "flex min-w-0 flex-1 flex-col overflow-hidden py-0",
            !seleccionadaId && "hidden lg:flex",
            // Por debajo de xl no entran tres columnas: la ficha ocupa el
            // lugar del hilo mientras esté abierta.
            fichaAbierta && "hidden xl:flex",
          )}
        >
          {seleccionada ? (
            <>
              <div className="flex items-center gap-3 border-b px-4 py-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setSeleccionadaId(null)}
                  aria-label="Volver a la lista de conversaciones"
                >
                  <ArrowLeft className="size-4" />
                </Button>
                <Avatar className="size-9">
                  <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                    {iniciales(seleccionada.pacienteNombre ?? seleccionada.nombre ?? seleccionada.telefono)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {seleccionada.pacienteNombre ?? seleccionada.nombre ?? seleccionada.telefono}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    +{seleccionada.telefono}
                  </p>
                </div>

                {/* Toggle IA / Humano */}
                <div className="flex items-center rounded-lg border bg-muted p-0.5">
                  <button
                    type="button"
                    onClick={() => manejarModo("ia")}
                    aria-pressed={seleccionada.modo === "ia"}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors duration-150",
                      seleccionada.modo === "ia"
                        ? "bg-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <Bot className="size-3.5" aria-hidden="true" />
                    Bot
                  </button>
                  <button
                    type="button"
                    onClick={() => manejarModo("humano")}
                    aria-pressed={seleccionada.modo === "humano"}
                    className={cn(
                      "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors duration-150",
                      seleccionada.modo === "humano"
                        ? "bg-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <User className="size-3.5" aria-hidden="true" />
                    Humano
                  </button>
                </div>

                {seleccionada.requiereAtencion && (
                  <Button variant="outline" size="sm" onClick={manejarAtendida}>
                    <CheckCheck className="size-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Marcar atendida</span>
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="icon"
                  className="xl:hidden"
                  onClick={() => setFichaAbierta(true)}
                  aria-label="Ver la ficha del paciente"
                >
                  <Contact className="size-4 text-muted-foreground" />
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Borrar conversación"
                    >
                      <Trash2 className="size-4 text-muted-foreground" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        ¿Borrar esta conversación?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Se borra todo el historial con{" "}
                        {seleccionada.pacienteNombre ?? seleccionada.nombre ?? seleccionada.telefono} del
                        panel. Los mensajes en el teléfono no se tocan.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={manejarBorrar}>
                        Borrar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <div
                ref={refMensajes}
                className="flex flex-1 flex-col gap-3 overflow-y-auto p-4"
              >
                {mensajes.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      // Tope absoluto además del %: con el hilo a ancho
                      // completo, un 70% son líneas de 900px ilegibles.
                      "flex max-w-[85%] flex-col gap-1 sm:max-w-[70%] xl:max-w-2xl",
                      m.rol === "cliente"
                        ? "items-start self-start"
                        : "items-end self-end",
                    )}
                  >
                    <div
                      className={cn(
                        "rounded-lg px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words",
                        m.rol === "cliente" && "bg-muted",
                        m.rol === "ia" && "border border-primary/20 bg-primary/5",
                        m.rol === "humano" && "border border-warning/40 bg-warning/10",
                        m.rol === "sistema" && "border border-success/40 bg-success/10",
                      )}
                    >
                      {m.rol === "ia" && (
                        <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-primary">
                          <Bot className="size-3" aria-hidden="true" />
                          Bot
                        </p>
                      )}
                      {m.rol === "humano" && (
                        <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-warning">
                          <User className="size-3" aria-hidden="true" />
                          Equipo
                        </p>
                      )}
                      {m.rol === "sistema" && (
                        <p className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-success">
                          <BellRing className="size-3" aria-hidden="true" />
                          Recordatorio
                        </p>
                      )}
                      {m.contenido}
                    </div>
                    <p className="px-1 text-[11px] text-muted-foreground">
                      {formatearHora(m.creadoEn)} hs
                    </p>
                  </div>
                ))}
              </div>

              <div className="border-t p-3">
                {seleccionada.modo === "ia" ? (
                  <p className="flex items-center justify-center gap-2 rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">
                    <Bot className="size-4" aria-hidden="true" />
                    El bot responde automáticamente. Pasá a modo Humano para
                    responder vos.
                  </p>
                ) : (
                  <div className="flex items-end gap-2">
                    <Textarea
                      value={borrador}
                      onChange={(e) => setBorrador(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          manejarEnviar();
                        }
                      }}
                      placeholder={`Respondé a ${
                        (seleccionada.pacienteNombre ?? seleccionada.nombre ?? seleccionada.telefono).split(
                          " ",
                        )[0]
                      }…`}
                      aria-label="Escribir mensaje"
                      rows={1}
                      className="max-h-32 min-h-10 flex-1 resize-none"
                    />
                    <Button
                      onClick={manejarEnviar}
                      disabled={!borrador.trim() || enviando}
                      size="icon"
                      aria-label="Enviar mensaje"
                      className="shrink-0"
                    >
                      <Send className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
              <MessageCircle
                className="size-8 text-muted-foreground"
                aria-hidden="true"
              />
              <p className="font-medium">Elegí una conversación</p>
              <p className="text-sm text-muted-foreground">
                Acá ves los mensajes del WhatsApp del consultorio y podés
                responder cuando haga falta.
              </p>
            </div>
          )}
        </Card>

        {/* Ficha del paciente: quién escribe y sus próximos turnos */}
        {seleccionada && (
          <Card
            className={cn(
              "min-w-0 flex-col overflow-hidden py-0 xl:w-84 xl:shrink-0 2xl:w-96",
              fichaAbierta ? "flex flex-1 xl:flex-none" : "hidden xl:flex",
            )}
          >
            <FichaPaciente
              conversacionId={seleccionada.id}
              paciente={paciente}
              nombreWa={seleccionada.nombre ?? ""}
              telefono={seleccionada.telefono}
              onCerrar={() => setFichaAbierta(false)}
            />
          </Card>
        )}
      </div>
    </div>
  );
}
