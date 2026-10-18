// @vitest-environment node
/**
 * Pruebas de integración del cliente HTTP real (src/api/http.ts) por la red, contra la API simulada.
 * Prueban lo mismo que se probará con FastAPI: login con formulario, header Bearer, parámetros,
 * códigos de error y el aviso de sesión expirada.
 */
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import * as E from "../src/api/esquemas";
import { crearServidorContrato } from "./servidorContrato";
import { verificarContrato } from "./verificarContrato";

let servidor: Server;
let baseUrl: string;

async function levantar(opciones?: Parameters<typeof crearServidorContrato>[0]) {
  const s = crearServidorContrato(opciones);
  await new Promise<void>((ok) => s.listen(0, "127.0.0.1", ok));
  return { s, url: `http://127.0.0.1:${(s.address() as AddressInfo).port}/api/v1` };
}

/** Importa el cliente HTTP con VITE_API_BASE_URL apuntando a la API simulada. */
async function cargarCliente() {
  vi.resetModules();
  vi.stubEnv("VITE_API_BASE_URL", baseUrl);
  const { httpClient } = await import("../src/api/http");
  const token = await import("../src/auth/token");
  const errores = await import("../src/api/errors");
  return { api: httpClient, ...token, ...errores };
}

beforeAll(async () => {
  ({ s: servidor, url: baseUrl } = await levantar());
});
afterAll(() => new Promise((ok) => servidor.close(ok)));
afterEach(() => vi.unstubAllEnvs());

describe("cliente HTTP contra la API simulada", () => {
  it("rechaza credenciales incorrectas con el mensaje de la interfaz", async () => {
    const { api } = await cargarCliente();
    await expect(api.login("demo@cotiza.test", "mala")).rejects.toMatchObject({ status: 401, message: "Correo o contraseña incorrectos." });
  });

  it("inicia sesión, envía el token y obtiene datos con la forma del contrato", async () => {
    const { api, setToken } = await cargarCliente();
    const { access_token } = await api.login("demo@cotiza.test", "demo1234");
    setToken(access_token);

    expect(E.Usuario.parse(await api.me()).email).toBe("demo@cotiza.test");
    expect(E.ClienteResumen.array().parse(await api.listarClientes()).length).toBeGreaterThan(0);

    const pagina = E.PaginaCotizaciones.parse(await api.listarCotizaciones({ anio: 2025, page: 2, page_size: 10 }));
    expect(pagina.page).toBe(2);
    expect(pagina.items).toHaveLength(10);
    expect(pagina.items.every((c) => c.fecha.startsWith("2025-"))).toBe(true);

    const detalle = E.CotizacionDetalle.parse(await api.obtenerCotizacion(pagina.items[0]!.id));
    expect(detalle.items.length).toBeGreaterThan(0);

    const resumen = E.MetricasResumen.parse(await api.metricasResumen({ anio: 2025 }));
    expect(resumen.total_cotizaciones).toBe(pagina.total);
    const meses = E.MetricasPorPeriodo.parse(await api.metricasPorPeriodo({ anio: 2025, granularidad: "mes" }));
    expect(meses.reduce((s, m) => s + m.monto_neto, 0)).toBe(resumen.monto_neto_total);
  });

  it("no envía filtros vacíos (un q vacío no debe llegar como ?q=)", async () => {
    const { api, setToken } = await cargarCliente();
    setToken((await api.login("demo@cotiza.test", "demo1234")).access_token);
    const conVacio = await api.listarCotizaciones({ q: "", page: 1, page_size: 5 });
    const sinFiltro = await api.listarCotizaciones({ page: 1, page_size: 5 });
    expect(conVacio.total).toBe(sinFiltro.total);
  });

  it("traduce el 404 de FastAPI al mensaje del backend", async () => {
    const { api, setToken } = await cargarCliente();
    setToken((await api.login("demo@cotiza.test", "demo1234")).access_token);
    await expect(api.obtenerCotizacion(999_999)).rejects.toMatchObject({ status: 404, message: "La cotización no existe o fue eliminada." });
  });

  it("ante un 401 avisa a la sesión para cerrarla (CP-F05)", async () => {
    const { api, setToken, registrarManejadorNoAutorizado } = await cargarCliente();
    const alExpirar = vi.fn();
    registrarManejadorNoAutorizado(alExpirar);
    setToken("token.invalido.x");
    await expect(api.listarClientes()).rejects.toMatchObject({ status: 401 });
    expect(alExpirar).toHaveBeenCalledTimes(1);
  });

  it("informa la falta de conexión cuando la API no responde (CP-F20)", async () => {
    const { s, url } = await levantar();
    await new Promise((ok) => s.close(ok));
    vi.resetModules();
    vi.stubEnv("VITE_API_BASE_URL", url);
    const { httpClient } = await import("../src/api/http");
    await expect(httpClient.listarClientes()).rejects.toMatchObject({ status: 0 });
  });
});

describe("verificación del contrato", () => {
  it("CP-F21: la API simulada cumple el contrato completo", async () => {
    const resultados = await verificarContrato({ baseUrl, email: "demo@cotiza.test", password: "demo1234" });
    expect(resultados.filter((r) => r.estado !== "ok")).toEqual([]);
    expect(resultados.length).toBeGreaterThan(25);
  });

  it("CP-F21: detecta montos serializados como texto (Decimal en Pydantic v2)", async () => {
    const { s, url } = await levantar({ defectoMontosComoTexto: true });
    const resultados = await verificarContrato({ baseUrl: url, email: "demo@cotiza.test", password: "demo1234" });
    await new Promise((ok) => s.close(ok));
    const fallas = resultados.filter((r) => r.estado === "falla");
    expect(fallas.map((f) => f.nombre)).toContain("GET /metricas/resumen");
    expect(fallas.find((f) => f.nombre === "GET /metricas/resumen")?.detalle).toMatch(/monto_neto_total: Expected number, received string/);
  });

  it("CP-F22: detecta CORS sin el origen del frontend", async () => {
    const { s, url } = await levantar({ origenes: ["http://otro-origen.test"] });
    const resultados = await verificarContrato({ baseUrl: url, email: "demo@cotiza.test", password: "demo1234" });
    await new Promise((ok) => s.close(ok));
    expect(resultados[0]).toMatchObject({ nombre: "CORS permite http://localhost:5173 con Authorization", estado: "falla" });
  });
});
