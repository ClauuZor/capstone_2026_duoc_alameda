import type { FiltrosCotizaciones, FiltrosMetricas } from "../api/types";

export const TAMANO_PAGINA = 20;

function entero(params: URLSearchParams, clave: string): number | undefined {
  const valor = params.get(clave);
  if (!valor) return undefined;
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

/** Los filtros viven en la URL: se pueden compartir, sobreviven a una recarga y "atrás" funciona. Valores inválidos se ignoran. */
export function leerFiltros(params: URLSearchParams): FiltrosCotizaciones {
  return {
    q: params.get("q")?.trim() || undefined,
    cliente_id: entero(params, "cliente_id"),
    anio: entero(params, "anio"),
    page: entero(params, "page") ?? 1,
    page_size: TAMANO_PAGINA,
  };
}

export function escribirFiltros(f: Partial<FiltrosCotizaciones>): URLSearchParams {
  const params = new URLSearchParams();
  if (f.q) params.set("q", f.q);
  if (f.cliente_id) params.set("cliente_id", String(f.cliente_id));
  if (f.anio) params.set("anio", String(f.anio));
  if (f.page && f.page > 1) params.set("page", String(f.page));
  return params;
}

export const hayFiltrosActivos = (f: FiltrosCotizaciones) => !!(f.q || f.cliente_id || f.anio);

/**
 * Filtros del resumen. Sin "anio" en la URL se muestra el año en curso;
 * "anio=todos" muestra todos los años.
 */
export function leerFiltrosResumen(params: URLSearchParams, anioActual = new Date().getFullYear()): FiltrosMetricas {
  const anio = params.get("anio") === "todos" ? undefined : (entero(params, "anio") ?? anioActual);
  return { anio, cliente_id: entero(params, "cliente_id") };
}

export function escribirFiltrosResumen(f: FiltrosMetricas, anioActual = new Date().getFullYear()): URLSearchParams {
  const params = new URLSearchParams();
  if (!f.anio) params.set("anio", "todos");
  else if (f.anio !== anioActual) params.set("anio", String(f.anio));
  if (f.cliente_id) params.set("cliente_id", String(f.cliente_id));
  return params;
}

export const totalPaginas = (total: number, tamano: number) => Math.max(1, Math.ceil(total / tamano));
