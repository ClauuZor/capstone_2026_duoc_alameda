/**
 * Lógica de consulta sobre los datos simulados, sin dependencias del navegador.
 * La usan el cliente simulado (modo mock) y el servidor que simula la API (scripts/api-simulada.ts),
 * para que ambos respondan exactamente lo mismo.
 */
import {
  DIMENSIONES_ATRIBUTO,
  type ClienteResumen,
  type CotizacionDetalle,
  type CotizacionResumen,
  type Dimension,
  type FiltrosCotizaciones,
  type FiltrosMetricas,
  type Granularidad,
  type MetricaDistribucion,
  type MetricaPeriodo,
  type MetricasResumen,
  type OpcionesFiltro,
  type Pagina,
} from "../types";
import { clientes, cotizaciones } from "./datos";

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

type Filtros = Omit<FiltrosCotizaciones, "page" | "page_size">;

function filtrar(f: Filtros) {
  const termino = f.q ? normalizar(f.q.trim()) : "";
  return cotizaciones.filter(
    (c) =>
      (!f.anio || c.fecha.startsWith(`${f.anio}-`)) &&
      (!f.cliente_id || c.cliente.id === f.cliente_id) &&
      DIMENSIONES_ATRIBUTO.every((d) => !f[d] || c[d] === f[d]) &&
      (f.monto_min === undefined || c.monto_neto >= f.monto_min) &&
      (f.monto_max === undefined || c.monto_neto <= f.monto_max) &&
      (!termino || normalizar(c.numero).includes(termino) || normalizar(c.cliente.nombre).includes(termino) || (c.cliente.rut ?? "").includes(termino)),
  );
}

const aResumen = ({
  items: _items,
  documento: _documento,
  proyecto: _proyecto,
  direccion: _direccion,
  fecha_vencimiento: _venc,
  cliente_telefono: _tel,
  cliente_email: _email,
  subtotal_bruto: _bruto,
  ...resto
}: CotizacionDetalle): CotizacionResumen => resto;

export function listarCotizaciones(f: FiltrosCotizaciones): Pagina<CotizacionResumen> {
  const lista = filtrar(f)
    .slice()
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id);
  const inicio = (f.page - 1) * f.page_size;
  return { items: lista.slice(inicio, inicio + f.page_size).map(aResumen), total: lista.length, page: f.page, page_size: f.page_size };
}

export function obtenerCotizacion(id: number): CotizacionDetalle | undefined {
  const c = cotizaciones.find((x) => x.id === id);
  return c && structuredClone(c);
}

export const listarClientes = (): ClienteResumen[] => clientes.slice().sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

export const aniosDisponibles = (): number[] => [...new Set(cotizaciones.map((c) => Number(c.fecha.slice(0, 4))))].sort((a, b) => b - a);

export function metricasResumen(f: FiltrosMetricas): MetricasResumen {
  const lista = filtrar(f);
  const suma = (fn: (c: CotizacionDetalle) => number) => lista.reduce((s, c) => s + fn(c), 0);
  return {
    total_cotizaciones: lista.length,
    clientes_unicos: new Set(lista.map((c) => c.cliente.id)).size,
    monto_neto_total: suma((c) => c.monto_neto),
    monto_total: suma((c) => c.total),
    descuento_total: suma((c) => c.descuento),
    cotizaciones_con_descuento: lista.filter((c) => c.descuento > 0).length,
    m2_cotizados: Math.round(suma((c) => c.items.reduce((s, it) => s + (it.es_servicio ? 0 : (it.m2 ?? 0)), 0)) * 10) / 10,
    cotizaciones_con_instalacion: lista.filter((c) => c.items.some((it) => it.categoria === "Instalación")).length,
  };
}

export function metricasPorPeriodo({ granularidad, ...f }: FiltrosMetricas & { granularidad: Granularidad }): MetricaPeriodo[] {
  const largo = granularidad === "mes" ? 7 : 4;
  const grupos = new Map<string, MetricaPeriodo>();
  for (const c of filtrar(f)) {
    const periodo = c.fecha.slice(0, largo);
    const g = grupos.get(periodo) ?? { periodo, cantidad: 0, monto_neto: 0 };
    g.cantidad += 1;
    g.monto_neto += c.monto_neto;
    grupos.set(periodo, g);
  }
  return [...grupos.values()].sort((a, b) => a.periodo.localeCompare(b.periodo));
}

export function metricasDistribucion({ dimension, limite = 10, ...f }: FiltrosMetricas & { dimension: Dimension; limite?: number }): MetricaDistribucion[] {
  const grupos = new Map<string, MetricaDistribucion>();
  const sumar = (clave: string | null, cantidad: number, monto: number) => {
    if (!clave) return;
    const g = grupos.get(clave) ?? { clave, cantidad: 0, monto_neto: 0 };
    g.cantidad += cantidad;
    g.monto_neto += monto;
    grupos.set(clave, g);
  };
  for (const c of filtrar(f)) {
    if (dimension === "producto") for (const it of c.items) !it.es_servicio && sumar(it.categoria, Math.round(it.cantidad), it.subtotal);
    else sumar(dimension === "cliente" ? c.cliente.nombre : c[dimension], 1, c.monto_neto);
  }
  return [...grupos.values()].sort((a, b) => b.monto_neto - a.monto_neto).slice(0, limite);
}

export function opcionesFiltro(): OpcionesFiltro {
  const opciones = {} as OpcionesFiltro;
  for (const d of DIMENSIONES_ATRIBUTO) {
    const frecuencia = new Map<string, number>();
    for (const c of cotizaciones) if (c[d]) frecuencia.set(c[d] as string, (frecuencia.get(c[d] as string) ?? 0) + 1);
    opciones[d] = [...frecuencia.entries()].sort((a, b) => b[1] - a[1]).map(([v]) => v);
  }
  return opciones;
}
