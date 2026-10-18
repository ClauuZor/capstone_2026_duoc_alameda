/**
 * Lógica de consulta sobre los datos simulados, sin dependencias del navegador.
 * La usan el cliente simulado (modo mock) y el servidor que simula la API (scripts/api-simulada.ts),
 * para que ambos respondan exactamente lo mismo.
 */
import type { ClienteResumen, CotizacionDetalle, CotizacionResumen, FiltrosCotizaciones, FiltrosMetricas, Granularidad, MetricaPeriodo, MetricasResumen, Pagina } from "../types";
import { clientes, cotizaciones } from "./datos";

const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

function filtrar({ q, cliente_id, anio }: { q?: string; cliente_id?: number; anio?: number }) {
  const termino = q ? normalizar(q.trim()) : "";
  return cotizaciones.filter(
    (c) =>
      (!anio || c.fecha.startsWith(`${anio}-`)) &&
      (!cliente_id || c.cliente.id === cliente_id) &&
      (!termino || normalizar(c.numero).includes(termino) || normalizar(c.cliente.nombre).includes(termino) || (c.cliente.rut ?? "").includes(termino)),
  );
}

const aResumen = ({ items: _items, documento: _documento, ...resto }: CotizacionDetalle): CotizacionResumen => resto;

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
  return {
    total_cotizaciones: lista.length,
    clientes_unicos: new Set(lista.map((c) => c.cliente.id)).size,
    monto_neto_total: lista.reduce((s, c) => s + c.monto_neto, 0),
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
