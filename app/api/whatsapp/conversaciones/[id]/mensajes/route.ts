import { NextResponse } from "next/server";
import { obtenerSesion } from "@/lib/auth/session";
import { obtenerConversacionWa } from "@/lib/data-whatsapp";

interface Ctx {
  // Next 16: params es una Promise en los route handlers.
  params: Promise<{ id: string }>;
}

/** Conversación + mensajes (orden cronológico) + ficha del paciente. */
export async function GET(_req: Request, { params }: Ctx) {
  const sesion = await obtenerSesion();
  if (!sesion) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  if (!/^\d+$/.test(id)) {
    return NextResponse.json({ error: "Id inválido" }, { status: 400 });
  }

  const resultado = await obtenerConversacionWa(id);
  if (!resultado) {
    return NextResponse.json({ error: "No existe" }, { status: 404 });
  }
  return NextResponse.json(resultado);
}
