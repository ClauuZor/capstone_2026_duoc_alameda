/**
 * Cliente simulado (VITE_API_MODE=mock), para desarrollar sin backend.
 * Aplica las reglas del contrato que afectan a la interfaz: sesión obligatoria, expiración del token y 404.
 */
import { config } from "../../config";
import { getToken } from "../../auth/token";
import { ApiError, mensajeDeError, notificarNoAutorizado } from "../errors";
import type { ApiClient } from "../types";
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
};
