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

/**
 * Atributos comerciales extraídos del PDF. Son opcionales (null) porque los formatos
 * antiguos no siempre los traen.
 */
export interface AtributosCotizacion {
  /** PARTICULAR, EMPRESA… */
  tipo_cliente: string | null;
  comuna: string | null;
  /** PVC, Aluminio o Solo vidrio. */
  material: string | null;
  color: string | null;
  /** Termopanel, Monolítico, Templado, Laminado… */
  vidrio: string | null;
  vendedor: string | null;
}

export interface CotizacionResumen extends AtributosCotizacion {
  id: number;
  numero: string;
  fecha: string;
  cliente: ClienteResumen;
  cantidad_items: number;
  monto_neto: number;
  iva: number;
  total: number;
  /** Descuento aplicado sobre el subtotal (0 si no hay). */
  descuento: number;
}

export interface ItemCotizacion {
  id: number;
  linea: number;
  descripcion: string;
  cantidad: number;
  unidad: string | null;
  precio_unitario: number;
  subtotal: number;
  /** Código de la ventana en el plano (V01, P02…). */
  denominacion: string | null;
  /** Medidas en metros, si el detalle las indica. */
  ancho_m: number | null;
  alto_m: number | null;
  /** Superficie total de la línea (ancho × alto × cantidad), en m². */
  m2: number | null;
  /** Corredera, Proyectante, Puerta, Instalación, Traslado… */
  categoria: string | null;
  es_servicio: boolean;
}

export interface DocumentoOrigen {
  nombre_archivo: string;
  url_drive: string | null;
}

export interface CotizacionDetalle extends CotizacionResumen {
  items: ItemCotizacion[];
  documento: DocumentoOrigen;
  proyecto: string | null;
  direccion: string | null;
  fecha_vencimiento: string | null;
  cliente_telefono: string | null;
  cliente_email: string | null;
  /** Subtotal antes del descuento. */
  subtotal_bruto: number;
}

export interface Pagina<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

/** Filtros por atributos, comunes al listado y a las métricas. */
export interface FiltrosAtributos {
  material?: string;
  color?: string;
  vidrio?: string;
  comuna?: string;
  vendedor?: string;
  tipo_cliente?: string;
}

export const DIMENSIONES_ATRIBUTO = ["material", "color", "vidrio", "comuna", "vendedor", "tipo_cliente"] as const;

/** El listado se ordena siempre por fecha descendente (desempate por id). */
export interface FiltrosCotizaciones extends FiltrosAtributos {
  q?: string;
  cliente_id?: number;
  anio?: number;
  /** Rango de monto neto, en CLP. */
  monto_min?: number;
  monto_max?: number;
  page: number;
  page_size: number;
}

export interface FiltrosMetricas extends FiltrosAtributos {
  anio?: number;
  cliente_id?: number;
}

export interface MetricasResumen {
  total_cotizaciones: number;
  clientes_unicos: number;
  /** Suma de montos netos (sin IVA). */
  monto_neto_total: number;
  /** Suma de totales con IVA. */
  monto_total: number;
  descuento_total: number;
  cotizaciones_con_descuento: number;
  /** Superficie cotizada (ítems con medidas). */
  m2_cotizados: number;
  /** Cotizaciones que incluyen instalación. */
  cotizaciones_con_instalacion: number;
}

export type Dimension = (typeof DIMENSIONES_ATRIBUTO)[number] | "cliente" | "producto";

export interface MetricaDistribucion {
  clave: string;
  /** Cotizaciones (o unidades, si la dimensión es "producto"). */
  cantidad: number;
  monto_neto: number;
}

/** Valores disponibles para cada filtro por atributo, del más al menos frecuente. */
export type OpcionesFiltro = Record<(typeof DIMENSIONES_ATRIBUTO)[number], string[]>;

export type Granularidad = "mes" | "anio";

export interface MetricaPeriodo {
  /** "YYYY-MM" si granularidad=mes, "YYYY" si granularidad=anio. */
  periodo: string;
  cantidad: number;
  monto_neto: number;
}

/* ---------- Google Drive e ingesta (Épica 001) ---------- */

export interface EstadoDrive {
  google_configurado: boolean;
  conectado: boolean;
  carpeta_configurada: boolean;
  carpeta_id: string | null;
  fecha_conexion: string | null;
}

/** Avance de la sincronización, que corre en segundo plano en el servidor. */
export interface ProgresoIngesta {
  estado: "inactivo" | "en_curso" | "terminado" | "cancelado" | "fallido";
  encontrados: number;
  /** PDF nuevos (o a reintentar) que se procesan en esta sincronización. */
  total: number;
  revisados: number;
  procesados: number;
  duplicados: number;
  errores: number;
  omitidos: number;
  mensaje: string | null;
  inicio: string | null;
  fin: string | null;
}

export type EstadoDocumento = "pendiente" | "procesado" | "duplicado" | "error";

export interface DocumentoIngesta {
  id: number;
  nombre_archivo: string;
  estado: EstadoDocumento;
  metodo_extraccion: string | null;
  error: string | null;
  cotizacion_id: number | null;
  url_drive: string | null;
  fecha_creacion: string;
  fecha_procesamiento: string | null;
}

export interface FiltrosDocumentos {
  estado?: EstadoDocumento;
  page: number;
  page_size: number;
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
  metricasDistribucion(filtros: FiltrosMetricas & { dimension: Dimension; limite?: number }): Promise<MetricaDistribucion[]>;
  opcionesFiltro(): Promise<OpcionesFiltro>;
  estadoDrive(): Promise<EstadoDrive>;
  /** Devuelve la URL de consentimiento de Google a la que hay que redirigir. */
  autorizarDrive(): Promise<{ authorization_url: string }>;
  definirCarpetaDrive(carpeta: string): Promise<EstadoDrive>;
  desconectarDrive(): Promise<void>;
  /** Inicia la sincronización en segundo plano; el avance se consulta con progresoSincronizacion. */
  sincronizarDrive(reintentarErrores: boolean, reprocesar?: boolean): Promise<ProgresoIngesta>;
  progresoSincronizacion(): Promise<ProgresoIngesta>;
  cancelarSincronizacion(): Promise<ProgresoIngesta>;
  listarDocumentos(filtros: FiltrosDocumentos): Promise<Pagina<DocumentoIngesta>>;
}
