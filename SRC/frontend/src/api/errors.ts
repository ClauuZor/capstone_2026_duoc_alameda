export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const MENSAJES: Record<number, string> = {
  0: "No se pudo conectar con el servidor. Revisa tu conexión o que la API esté en ejecución.",
  400: "La solicitud no es válida.",
  401: "Tu sesión expiró. Inicia sesión nuevamente.",
  403: "No tienes permisos para ver esta sección.",
  404: "No encontramos lo que buscas.",
  422: "Los filtros enviados no son válidos.",
};

/** Traduce el cuerpo de error de FastAPI ({detail: string | ValidationError[]}) a un mensaje para la interfaz. */
export function mensajeDeError(status: number, cuerpo: unknown): string {
  const detail = (cuerpo as { detail?: unknown } | null)?.detail;
  if (status >= 500) return "El servidor tuvo un problema. Intenta de nuevo en unos minutos.";
  if (typeof detail === "string" && detail.trim()) return detail;
  return MENSAJES[status] ?? `Error inesperado (${status}).`;
}

type Listener = () => void;
let alExpirarSesion: Listener | null = null;

/** El AuthProvider se registra aquí para cerrar sesión cuando la API responde 401. */
export function registrarManejadorNoAutorizado(fn: Listener | null) {
  alExpirarSesion = fn;
}

export function notificarNoAutorizado() {
  alExpirarSesion?.();
}
