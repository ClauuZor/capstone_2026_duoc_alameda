/**
 * Tipos del contrato frontend ↔ API (ver ../docs/contrato-api.md).
 * Deben mantenerse alineados con los esquemas Pydantic de FastAPI.
 * Montos: pesos chilenos como enteros (int), nunca Decimal serializado como string.
 * Fechas: "YYYY-MM-DD".
 */

export interface Usuario {
  id: number;
  email: string;
  nombre: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: "bearer";
}

export interface ClienteResumen {
  id: number;
  nombre: string;
  rut: string | null;
}

export interface CotizacionResumen {
  id: number;
  numero: string;
  fecha: string;
  cliente: ClienteResumen;
  cantidad_items: number;
  monto_neto: number;
  iva: number;
  total: number;
}

export interface ItemCotizacion {
  id: number;
  linea: number;
  descripcion: string;
  cantidad: number;
  unidad: string | null;
  precio_unitario: number;
  subtotal: number;
}

export interface DocumentoOrigen {
  nombre_archivo: string;
  url_drive: string | null;
}

export interface CotizacionDetalle extends CotizacionResumen {
  items: ItemCotizacion[];
  documento: DocumentoOrigen;
}

export interface Pagina<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

/** El listado se ordena siempre por fecha descendente (desempate por id). */
export interface FiltrosCotizaciones {
  q?: string;
  cliente_id?: number;
  anio?: number;
  page: number;
  page_size: number;
}

export interface FiltrosMetricas {
  anio?: number;
  cliente_id?: number;
}

export interface MetricasResumen {
  total_cotizaciones: number;
  clientes_unicos: number;
  /** Suma de montos netos (sin IVA). */
  monto_neto_total: number;
}

export type Granularidad = "mes" | "anio";

export interface MetricaPeriodo {
  /** "YYYY-MM" si granularidad=mes, "YYYY" si granularidad=anio. */
  periodo: string;
  cantidad: number;
  monto_neto: number;
}

export interface ApiClient {
  login(email: string, password: string): Promise<TokenResponse>;
  me(): Promise<Usuario>;
  listarCotizaciones(filtros: FiltrosCotizaciones): Promise<Pagina<CotizacionResumen>>;
  obtenerCotizacion(id: number): Promise<CotizacionDetalle>;
  listarClientes(): Promise<ClienteResumen[]>;
  aniosDisponibles(): Promise<number[]>;
  metricasResumen(filtros: FiltrosMetricas): Promise<MetricasResumen>;
  metricasPorPeriodo(filtros: FiltrosMetricas & { granularidad: Granularidad }): Promise<MetricaPeriodo[]>;
}
