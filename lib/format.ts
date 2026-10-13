const pesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

const numero = new Intl.NumberFormat("es-AR");

export function formatearPesos(valor: number): string {
  return pesos.format(valor);
}

export function formatearPesosCompacto(valor: number): string {
  if (Math.abs(valor) >= 1_000_000) {
    const millones = valor / 1_000_000;
    return `$${numero.format(Math.round(millones * 10) / 10)} M`;
  }
  return pesos.format(valor);
}

export function formatearNumero(valor: number): string {
  return numero.format(valor);
}

export function formatearPorcentaje(valor: number): string {
  return `${numero.format(Math.round(valor * 100))}%`;
}

export function formatearDuracion(segundos: number): string {
  if (segundos < 60) return `${segundos}s`;
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  return seg > 0 ? `${min}m ${seg}s` : `${min}m`;
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "2026-07" → "julio". */
export function nombreMes(anioMes: string): string {
  return MESES[Number(anioMes.slice(5, 7)) - 1] ?? anioMes;
}

/** "2026-07" → "julio 2026". */
export function formatearMes(anioMes: string): string {
  return `${nombreMes(anioMes)} ${anioMes.slice(0, 4)}`;
}

export function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
  });
}

export function formatearFechaCompleta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export function formatearHora(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function tiempoRelativo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const futuro = diffMs < 0;
  const diff = Math.abs(diffMs);
  const min = Math.floor(diff / 60_000);
  const horas = Math.floor(min / 60);
  const dias = Math.floor(horas / 24);

  let texto: string;
  if (min < 1) texto = "ahora";
  else if (min < 60) texto = `${min} min`;
  else if (horas < 24) texto = `${horas} h`;
  else texto = `${dias} d`;

  if (texto === "ahora") return texto;
  return futuro ? `en ${texto}` : `hace ${texto}`;
}

/** "3 órdenes" / "1 orden": evita el clásico "1 órdenes". */
export function pluralizar(
  cantidad: number,
  singular: string,
  plural: string,
): string {
  return `${formatearNumero(cantidad)} ${cantidad === 1 ? singular : plural}`;
}

export function iniciales(nombre: string): string {
  return nombre
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
