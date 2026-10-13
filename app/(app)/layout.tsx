// Render dinámico: los datos dependen del usuario en sesión y cambian por request.
export const dynamic = "force-dynamic";

import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { usuarioActual } from "@/lib/auth";
import { obtenerConsultorio } from "@/lib/data";
import { ROLES } from "@/lib/labels";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [usuario, consultorio] = await Promise.all([
    usuarioActual(),
    obtenerConsultorio(),
  ]);

  return (
    <div className="flex min-h-dvh w-full">
      <Sidebar nombreConsultorio={consultorio.nombre} />
      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <Topbar
          nombreUsuario={usuario.nombre}
          rolUsuario={ROLES[usuario.rol]}
          nombreConsultorio={consultorio.nombre}
        />
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
