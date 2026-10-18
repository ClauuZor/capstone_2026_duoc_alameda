const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const numero = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 });
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sept", "oct", "nov", "dic"];

export const formatCLP = (monto: number) => clp.format(monto);
export const formatNumero = (n: number) => numero.format(n);

/** Formato corto para ejes de gráficos: $850 mil, $12,4 M, $1.204 M. */
export function formatCLPCorto(monto: number): string {
  const abs = Math.abs(monto);
  if (abs >= 1_000_000) return `$${numero.format(Math.round((monto / 1_000_000) * 10) / 10)} M`;
  if (abs >= 1_000) return `$${numero.format(Math.round(monto / 1_000))} mil`;
  return formatCLP(monto);
}

/**
 * "2026-03-14" → "14 mar 2026".
 * No usa `new Date("YYYY-MM-DD")`: eso interpreta la fecha en UTC y en Chile (UTC-3/-4)
 * la mostraría como el día anterior.
 */
export function formatFecha(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  if (!a || !m || !d) return fecha;
  return `${d} ${MESES[m - 1]} ${a}`;
}

export function formatFechaHora(iso: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return iso;
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(t);
}

/** "2026-03" → "mar" (o "mar 2026" con año); "2026" → "2026". */
export function formatPeriodo(periodo: string, conAnio = false): string {
  const [a, m] = periodo.split("-");
  if (!m) return periodo;
  const mes = MESES[Number(m) - 1] ?? m;
  return conAnio ? `${mes} ${a}` : mes;
}

export const plural = (n: number, singular: string, pluralForma = `${singular}s`) =>
  `${formatNumero(n)} ${n === 1 ? singular : pluralForma}`;
