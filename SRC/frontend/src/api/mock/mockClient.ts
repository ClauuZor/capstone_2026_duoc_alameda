/**
 * Cliente simulado (VITE_API_MODE=mock), para desarrollar sin backend.
 * Aplica las reglas del contrato que afectan a la interfaz: sesión obligatoria, expiración del token y 404.
 */
import { config } from "../../config";
import { getToken } from "../../auth/token";
import { ApiError, mensajeDeError, notificarNoAutorizado } from "../errors";
import type { ApiClient, DocumentoIngesta, EstadoDrive, ProgresoIngesta } from "../types";
import * as consultas from "./consultas";
import { credencialesValidas, crearTokenMock, usuarioDelToken } from "./tokenMock";

export { crearTokenMock, DURACION_SESION_MS } from "./tokenMock";

const esperar = () => new Promise((r) => setTimeout(r, config.mockLatencyMs + Math.random() * (config.mockLatencyMs / 2)));

function exigirSesion() {
  const usuario = usuarioDelToken(getToken());
  if (!usuario) {
    notificarNoAutorizado();
    throw new ApiError(401, mensajeDeError(401, null));
  }
  return usuario;
}

/** Simula la latencia de red y exige sesión antes de responder. */
async function protegido<T>(fn: () => T): Promise<T> {
  await esperar();
  exigirSesion();
  return fn();
}

export const mockClient: ApiClient = {
  async login(email, password) {
    await esperar();
    const usuario = credencialesValidas(email, password);
    if (!usuario) throw new ApiError(401, "Correo o contraseña incorrectos.");
    return { access_token: crearTokenMock(usuario.email), token_type: "bearer" };
  },

  async me() {
    await esperar();
    const { password: _password, ...usuario } = exigirSesion();
    return usuario;
  },

  listarCotizaciones: (f) => protegido(() => consultas.listarCotizaciones(f)),

  obtenerCotizacion: (id) =>
    protegido(() => {
      const c = consultas.obtenerCotizacion(id);
      if (!c) throw new ApiError(404, "La cotización no existe o fue eliminada.");
      return c;
    }),

  listarClientes: () => protegido(consultas.listarClientes),
  aniosDisponibles: () => protegido(consultas.aniosDisponibles),
  metricasResumen: (f) => protegido(() => consultas.metricasResumen(f)),
  metricasPorPeriodo: (f) => protegido(() => consultas.metricasPorPeriodo(f)),
  metricasDistribucion: (f) => protegido(() => consultas.metricasDistribucion(f)),
  opcionesFiltro: () => protegido(consultas.opcionesFiltro),

  estadoDrive: () => protegido(() => ({ ...drive.estado })),
  // Sin Google real: la "autorización" vuelve directo a la sección con éxito (ruta interna).
  autorizarDrive: () =>
    protegido(() => {
      drive.estado = { ...drive.estado, conectado: true, fecha_conexion: new Date().toISOString() };
      return { authorization_url: "/drive?drive=conectado" };
    }),
  definirCarpetaDrive: (carpeta) =>
    protegido(() => {
      const id = carpeta.match(/\/folders\/([\w-]+)/)?.[1] ?? carpeta.trim();
      if (!/^[\w-]{10,200}$/.test(id)) throw new ApiError(422, "No es un ID ni un enlace válido de carpeta de Google Drive");
      drive.estado = { ...drive.estado, carpeta_id: id, carpeta_configurada: true };
      return { ...drive.estado };
    }),
  desconectarDrive: () =>
    protegido(() => {
      drive.estado = { ...drive.estado, conectado: false, fecha_conexion: null };
    }),
  // El mock termina al instante: no hay PDF nuevos que procesar.
  sincronizarDrive: () =>
    protegido(() => {
      if (!drive.estado.conectado) throw new ApiError(409, "La empresa no ha conectado Google Drive");
      const ahora = new Date().toISOString();
      const n = drive.documentos.length;
      drive.progreso = { ...progresoInactivo, estado: "terminado", encontrados: n, omitidos: n, inicio: ahora, fin: ahora };
      return { ...drive.progreso };
    }),
  progresoSincronizacion: () => protegido(() => ({ ...drive.progreso })),
  cancelarSincronizacion: () =>
    protegido(() => {
      throw new ApiError(409, "No hay una sincronización en curso");
    }),
  listarDocumentos: (f) =>
    protegido(() => {
      const lista = drive.documentos.filter((d) => !f.estado || d.estado === f.estado);
      const inicio = (f.page - 1) * f.page_size;
      return { items: lista.slice(inicio, inicio + f.page_size), total: lista.length, page: f.page, page_size: f.page_size };
    }),
};

/** Estado simulado de la conexión con Drive (se reinicia al recargar la página). */
const progresoInactivo: ProgresoIngesta = {
  estado: "inactivo", encontrados: 0, total: 0, revisados: 0, procesados: 0, duplicados: 0, errores: 0, omitidos: 0, mensaje: null, inicio: null, fin: null,
};

const drive: { estado: EstadoDrive; progreso: ProgresoIngesta; documentos: DocumentoIngesta[] } = {
  estado: { google_configurado: true, conectado: false, carpeta_configurada: false, carpeta_id: null, fecha_conexion: null },
  progreso: progresoInactivo,
  documentos: [
    { id: 3, nombre_archivo: "escaneo_obra_norte.pdf", estado: "error", metodo_extraccion: null, error: "El PDF no contiene texto seleccionable (¿es un escaneo?)", cotizacion_id: null, url_drive: null, fecha_creacion: "2025-11-03T13:10:00Z", fecha_procesamiento: "2025-11-03T13:10:02Z" },
    { id: 2, nombre_archivo: "Cotizacion_COT-2024-0192 (1).pdf", estado: "duplicado", metodo_extraccion: "reglas", error: "La cotización COT-2024-0192 ya estaba registrada", cotizacion_id: 61, url_drive: null, fecha_creacion: "2025-11-02T10:00:00Z", fecha_procesamiento: "2025-11-02T10:00:03Z" },
    { id: 1, nombre_archivo: "Cotizacion_COT-2024-0192.pdf", estado: "procesado", metodo_extraccion: "reglas", error: null, cotizacion_id: 61, url_drive: null, fecha_creacion: "2025-11-01T09:00:00Z", fecha_procesamiento: "2025-11-01T09:00:04Z" },
  ],
};
