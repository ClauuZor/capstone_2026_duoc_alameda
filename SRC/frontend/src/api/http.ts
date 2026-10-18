import { config } from "../config";
import { getToken } from "../auth/token";
import { ApiError, mensajeDeError, notificarNoAutorizado } from "./errors";
import type { ApiClient } from "./types";

type Consulta = Record<string, string | number | undefined | null>;

interface Opciones {
  metodo?: "GET" | "POST";
  consulta?: Consulta;
  formulario?: Record<string, string>;
  autenticada?: boolean;
}

function construirUrl(ruta: string, consulta?: Consulta) {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(consulta ?? {})) {
    if (valor !== undefined && valor !== null && valor !== "") params.set(clave, String(valor));
  }
  const qs = params.toString();
  return `${config.apiBaseUrl}${ruta}${qs ? `?${qs}` : ""}`;
}

async function solicitar<T>(ruta: string, { metodo = "GET", consulta, formulario, autenticada = true }: Opciones = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const token = getToken();
  if (autenticada && token) headers.Authorization = `Bearer ${token}`;

  let body: string | undefined;
  if (formulario) {
    headers["Content-Type"] = "application/x-www-form-urlencoded";
    body = new URLSearchParams(formulario).toString();
  }

  let respuesta: Response;
  try {
    respuesta = await fetch(construirUrl(ruta, consulta), { method: metodo, headers, body });
  } catch {
    throw new ApiError(0, mensajeDeError(0, null));
  }

  if (respuesta.status === 401 && autenticada) {
    notificarNoAutorizado();
    throw new ApiError(401, mensajeDeError(401, null));
  }

  if (!respuesta.ok) {
    const cuerpo = await respuesta.json().catch(() => null);
    throw new ApiError(respuesta.status, mensajeDeError(respuesta.status, cuerpo));
  }

  if (respuesta.status === 204) return undefined as T;
  return (await respuesta.json()) as T;
}

export const httpClient: ApiClient = {
  async login(email, password) {
    try {
      // FastAPI OAuth2PasswordRequestForm: x-www-form-urlencoded con `username` y `password`.
      return await solicitar("/auth/login", { metodo: "POST", formulario: { username: email, password }, autenticada: false });
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 400)) {
        throw new ApiError(401, "Correo o contraseña incorrectos.");
      }
      throw e;
    }
  },
  me: () => solicitar("/auth/me"),
  listarCotizaciones: (f) => solicitar("/cotizaciones", { consulta: { ...f } }),
  obtenerCotizacion: (id) => solicitar(`/cotizaciones/${id}`),
  listarClientes: () => solicitar("/clientes"),
  aniosDisponibles: () => solicitar("/metricas/anios"),
  metricasResumen: (f) => solicitar("/metricas/resumen", { consulta: { ...f } }),
  metricasPorPeriodo: (f) => solicitar("/metricas/por-periodo", { consulta: { ...f } }),
};
