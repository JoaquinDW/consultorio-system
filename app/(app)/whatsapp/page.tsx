import {
  obtenerConversacionesWa,
  obtenerEstadoConexionWa,
} from "@/lib/data-whatsapp";
import { WhatsappCliente } from "./whatsapp-cliente";

export const metadata = { title: "WhatsApp" };

export default async function WhatsappPage() {
  // Primer paint sin flash; de acá en más manda el polling del cliente.
  const [estado, conversaciones] = await Promise.all([
    obtenerEstadoConexionWa(),
    obtenerConversacionesWa(),
  ]);

  return (
    <WhatsappCliente
      estadoInicial={estado}
      conversacionesIniciales={conversaciones}
    />
  );
}
