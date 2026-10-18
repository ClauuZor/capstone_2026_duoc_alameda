/**
 * Servidor HTTP que simula la API de Cotiza+ según docs/contrato-api.md.
 *
 * NO es el backend: no lee Google Drive, no extrae PDFs ni usa PostgreSQL. Es un doble de prueba
 * que responde con los datos simulados del frontend, imitando el comportamiento de FastAPI
 * (OAuth2PasswordRequestForm, 401 con WWW-Authenticate, 422 de validación, CORSMiddleware).
 * Sirve para probar el cliente HTTP real (VITE_API_MODE=http) y la verificación del contrato
 * antes de que exista la API.
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import * as consultas from "../src/api/mock/consultas";
import { credencialesValidas, crearTokenMock, usuarioDelToken } from "../src/api/mock/tokenMock";

export interface OpcionesServidor {
  /** Orígenes permitidos por CORS. Por defecto, el servidor de desarrollo y la vista previa de Vite. */
  origenes?: string[];
  /** Solo para pruebas: devuelve los montos como texto, el error típico de Decimal en Pydantic v2. */
  defectoMontosComoTexto?: boolean;
}

const BASE = "/api/v1";
const ORIGENES_POR_DEFECTO = ["http://localhost:5173", "http://localhost:4173", "http://127.0.0.1:5173", "http://127.0.0.1:4173"];

class ErrorHttp extends Error {
  constructor(
    public readonly status: number,
    public readonly cuerpo: unknown,
    public readonly headers: Record<string, string> = {},
  ) {
    super(String(status));
  }
}

const noAutenticado = () => new ErrorHttp(401, { detail: "Not authenticated" }, { "WWW-Authenticate": "Bearer" });

function errorValidacion(campo: string, msg: string, input: string | null) {
  return new ErrorHttp(422, { detail: [{ type: "value_error", loc: ["query", campo], msg, input }] });
}

function entero(params: URLSearchParams, campo: string, { min, max, requerido = false }: { min?: number; max?: number; requerido?: boolean } = {}) {
  const valor = params.get(campo);
  if (valor === null || valor === "") {
    if (requerido) throw errorValidacion(campo, "Field required", null);
    return undefined;
  }
  const n = Number(valor);
  if (!Number.isInteger(n)) throw errorValidacion(campo, "Input should be a valid integer", valor);
  if (min !== undefined && n < min) throw errorValidacion(campo, `Input should be greater than or equal to ${min}`, valor);
  if (max !== undefined && n > max) throw errorValidacion(campo, `Input should be less than or equal to ${max}`, valor);
  return n;
}

function filtrosMetricas(params: URLSearchParams) {
  return { anio: entero(params, "anio", { min: 2000, max: 2100 }), cliente_id: entero(params, "cliente_id", { min: 1 }) };
}

async function leerFormulario(req: IncomingMessage) {
  let cuerpo = "";
  for await (const parte of req) cuerpo += parte;
  return new URLSearchParams(cuerpo);
}

function exigirSesion(req: IncomingMessage) {
  const [esquema, token] = (req.headers.authorization ?? "").split(" ");
  if (esquema?.toLowerCase() !== "bearer" || !token || !usuarioDelToken(token)) throw noAutenticado();
  return usuarioDelToken(token)!;
}

async function enrutar(req: IncomingMessage, url: URL): Promise<unknown> {
  const ruta = url.pathname.slice(BASE.length) || "/";
  const p = url.searchParams;

  if (req.method === "POST" && ruta === "/auth/login") {
    if (!(req.headers["content-type"] ?? "").includes("application/x-www-form-urlencoded")) {
      throw new ErrorHttp(422, { detail: [{ type: "missing", loc: ["body", "username"], msg: "Field required", input: null }] });
    }
    const form = await leerFormulario(req);
    const usuario = credencialesValidas(form.get("username") ?? "", form.get("password") ?? "");
    if (!usuario) throw new ErrorHttp(401, { detail: "Incorrect username or password" }, { "WWW-Authenticate": "Bearer" });
    return { access_token: crearTokenMock(usuario.email), token_type: "bearer" };
  }

  if (req.method !== "GET") throw new ErrorHttp(405, { detail: "Method Not Allowed" });
  const usuario = exigirSesion(req);

  if (ruta === "/auth/me") return { id: usuario.id, email: usuario.email, nombre: usuario.nombre };
  if (ruta === "/clientes") return consultas.listarClientes();
  if (ruta === "/metricas/anios") return consultas.aniosDisponibles();
  if (ruta === "/metricas/resumen") return consultas.metricasResumen(filtrosMetricas(p));
  if (ruta === "/metricas/por-periodo") {
    const granularidad = p.get("granularidad");
    if (granularidad !== "mes" && granularidad !== "anio") throw errorValidacion("granularidad", "Input should be 'mes' or 'anio'", granularidad);
    return consultas.metricasPorPeriodo({ ...filtrosMetricas(p), granularidad });
  }
  if (ruta === "/cotizaciones") {
    return consultas.listarCotizaciones({
      q: p.get("q")?.trim() || undefined,
      ...filtrosMetricas(p),
      page: entero(p, "page", { min: 1 }) ?? 1,
      page_size: entero(p, "page_size", { min: 1, max: 100 }) ?? 20,
    });
  }
  const detalle = ruta.match(/^\/cotizaciones\/([^/]+)$/);
  if (detalle) {
    const id = Number(detalle[1]);
    if (!Number.isInteger(id)) throw new ErrorHttp(422, { detail: [{ type: "int_parsing", loc: ["path", "id"], msg: "Input should be a valid integer", input: detalle[1] }] });
    const c = consultas.obtenerCotizacion(id);
    if (!c) throw new ErrorHttp(404, { detail: "La cotización no existe o fue eliminada." });
    return c;
  }
  throw new ErrorHttp(404, { detail: "Not Found" });
}

function montosATexto(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(montosATexto);
  if (valor && typeof valor === "object") {
    return Object.fromEntries(
      Object.entries(valor).map(([k, v]) => [k, /monto|iva|total$|precio|subtotal/.test(k) && typeof v === "number" ? String(v) : montosATexto(v)]),
    );
  }
  return valor;
}

export function crearServidorContrato(opciones: OpcionesServidor = {}) {
  const origenes = new Set(opciones.origenes ?? ORIGENES_POR_DEFECTO);

  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const origen = req.headers.origin;
    const headers: Record<string, string> = { "Content-Type": "application/json; charset=utf-8" };
    if (origen && origenes.has(origen)) {
      headers["Access-Control-Allow-Origin"] = origen;
      headers["Vary"] = "Origin";
    }

    // Preflight de CORS: el navegador lo envía antes de cualquier request con Authorization.
    if (req.method === "OPTIONS") {
      if (!origen || !origenes.has(origen)) {
        res.writeHead(400, { "Content-Type": "text/plain" }).end("Disallowed CORS origin");
        return;
      }
      res
        .writeHead(200, {
          ...headers,
          "Access-Control-Allow-Methods": "GET, POST",
          "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept",
          "Access-Control-Max-Age": "600",
        })
        .end();
      return;
    }

    const url = new URL(req.url ?? "/", "http://localhost");
    try {
      if (!url.pathname.startsWith(BASE)) throw new ErrorHttp(404, { detail: "Not Found" });
      const cuerpo = await enrutar(req, url);
      res.writeHead(200, headers).end(JSON.stringify(opciones.defectoMontosComoTexto ? montosATexto(cuerpo) : cuerpo));
    } catch (e) {
      if (e instanceof ErrorHttp) {
        res.writeHead(e.status, { ...headers, ...e.headers }).end(JSON.stringify(e.cuerpo));
      } else {
        console.error(e);
        res.writeHead(500, headers).end(JSON.stringify({ detail: "Internal Server Error" }));
      }
    }
  });
}
