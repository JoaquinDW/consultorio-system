/**
 * Estado compartido por las Server Actions de los formularios
 * (usado con `useActionState` en el cliente, ver components/app/formulario-dialogo.tsx).
 */
export interface EstadoFormulario {
  ok: boolean;
  error?: string;
}

export const ESTADO_INICIAL: EstadoFormulario = { ok: false };

/** Devuelve el texto recortado, o `null` si viene vacío. */
export function aTexto(valor: FormDataEntryValue | null): string | null {
  const s = String(valor ?? "").trim();
  return s.length > 0 ? s : null;
}

/** Devuelve el número, o `null` si viene vacío o no es válido. */
export function aNumero(valor: FormDataEntryValue | null): number | null {
  const s = String(valor ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Traduce errores de Postgres a un mensaje en español rioplatense.
 * `23505` = violación de índice único.
 */
export function mensajeDeError(error: unknown, duplicado: string): EstadoFormulario {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  ) {
    return { ok: false, error: duplicado };
  }
  console.error(error);
  return {
    ok: false,
    error: "No pudimos guardar. Revisá los datos e intentá de nuevo.",
  };
}
