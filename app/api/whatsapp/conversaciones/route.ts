import { NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth/session";
import { obtenerConversacionesWa } from "@/lib/data-whatsapp";

/** Lista de conversaciones de WhatsApp, la más reciente primero. */
export async function GET() {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return NextResponse.json({ conversaciones: await obtenerConversacionesWa() });
}
