import { DIMENSIONES_ATRIBUTO, type FiltrosAtributos, type FiltrosCotizaciones, type FiltrosMetricas } from "../api/types";

function leerAtributos(params: URLSearchParams): FiltrosAtributos {
  const f: FiltrosAtributos = {};
  for (const d of DIMENSIONES_ATRIBUTO) {
    const valor = params.get(d)?.trim();
    if (valor) f[d] = valor;
  }
  return f;
}

function escribirAtributos(params: URLSearchParams, f: FiltrosAtributos) {
  for (const d of DIMENSIONES_ATRIBUTO) if (f[d]) params.set(d, f[d] as string);
}

const montoParam = (params: URLSearchParams, clave: string) => {
  const n = Number(params.get(clave));
  return params.get(clave) && Number.isFinite(n) && n >= 0 ? Math.round(n) : undefined;
};

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
    ...leerAtributos(params),
    monto_min: montoParam(params, "monto_min"),
    monto_max: montoParam(params, "monto_max"),
    page: entero(params, "page") ?? 1,
    page_size: TAMANO_PAGINA,
  };
}

export function escribirFiltros(f: Partial<FiltrosCotizaciones>): URLSearchParams {
  const params = new URLSearchParams();
  if (f.q) params.set("q", f.q);
  if (f.cliente_id) params.set("cliente_id", String(f.cliente_id));
  if (f.anio) params.set("anio", String(f.anio));
  escribirAtributos(params, f);
  if (f.monto_min !== undefined) params.set("monto_min", String(f.monto_min));
  if (f.monto_max !== undefined) params.set("monto_max", String(f.monto_max));
  if (f.page && f.page > 1) params.set("page", String(f.page));
  return params;
}

export const hayFiltrosAtributo = (f: FiltrosAtributos) => DIMENSIONES_ATRIBUTO.some((d) => !!f[d]);

export const hayFiltrosActivos = (f: FiltrosCotizaciones) =>
  !!(f.q || f.cliente_id || f.anio || f.monto_min !== undefined || f.monto_max !== undefined || hayFiltrosAtributo(f));

/**
 * Filtros del resumen. Sin "anio" en la URL se muestra el año en curso;
 * "anio=todos" muestra todos los años.
 */
export function leerFiltrosResumen(params: URLSearchParams, anioActual = new Date().getFullYear()): FiltrosMetricas {
  const anio = params.get("anio") === "todos" ? undefined : (entero(params, "anio") ?? anioActual);
  return { anio, cliente_id: entero(params, "cliente_id"), ...leerAtributos(params) };
}

export function escribirFiltrosResumen(f: FiltrosMetricas, anioActual = new Date().getFullYear()): URLSearchParams {
  const params = new URLSearchParams();
  if (!f.anio) params.set("anio", "todos");
  else if (f.anio !== anioActual) params.set("anio", String(f.anio));
  if (f.cliente_id) params.set("cliente_id", String(f.cliente_id));
  escribirAtributos(params, f);
  return params;
}

export const totalPaginas = (total: number, tamano: number) => Math.max(1, Math.ceil(total / tamano));
