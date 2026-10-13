import { NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth/session";
import { obtenerEstadoConexionWa } from "@/lib/data-whatsapp";

/** Estado de la conexión de WhatsApp (+ QR como PNG data-url si hay). */
export async function GET() {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  return NextResponse.json(await obtenerEstadoConexionWa());
}
