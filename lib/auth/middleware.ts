import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESION } from "./constants";

const RUTAS_PUBLICAS = ["/login", "/api/auth"];

/**
 * Corre en el Edge runtime: NO importar pg ni redis acá.
 * Solo chequea la presencia de la cookie de sesión; la validación real contra
 * Redis ocurre en usuarioActual()/los Server Components (runtime Node).
 */
export function updateSession(request: NextRequest): NextResponse {
  const esRutaPublica = RUTAS_PUBLICAS.some((ruta) =>
    request.nextUrl.pathname.startsWith(ruta),
  );

  const tieneSesion = Boolean(request.cookies.get(COOKIE_SESION)?.value);

  if (!tieneSesion && !esRutaPublica) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request });
}
