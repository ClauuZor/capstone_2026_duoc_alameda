/**
 * Verifica que una API cumpla docs/contrato-api.md: formas de las respuestas, códigos de error,
 * CORS, filtros, paginación y coherencia entre métricas y listado.
 * Se usa contra el backend real apenas exista (npm run verificar:api) y, en las pruebas, contra la API simulada.
 */
import type { z } from "zod";
import * as E from "../src/api/esquemas";
import { decodificarJwt } from "../src/auth/token";

export type Estado = "ok" | "falla" | "advertencia";
export interface Resultado {
  nombre: string;
  estado: Estado;
  detalle?: string;
}

export interface OpcionesVerificacion {
  baseUrl: string;
  email: string;
  password: string;
  /** Origen del frontend para comprobar CORS. */
  origen?: string;
}

function describirErrores(error: z.ZodError) {
  return error.issues
    .slice(0, 3)
    .map((i) => `${i.path.join(".") || "(raíz)"}: ${i.message}`)
    .join("; ");
}

export async function verificarContrato({ baseUrl, email, password, origen = "http://localhost:5173" }: OpcionesVerificacion): Promise<Resultado[]> {
  const base = baseUrl.replace(/\/$/, "");
  const resultados: Resultado[] = [];
  const registrar = (nombre: string, estado: Estado, detalle?: string) => resultados.push({ nombre, estado, detalle });
  let token = "";

  async function pedir(ruta: string, init: RequestInit = {}, conToken = true) {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    if (conToken && token) headers.set("Authorization", `Bearer ${token}`);
    const r = await fetch(base + ruta, { ...init, headers });
    const cuerpo = await r.json().catch(() => null);
    return { status: r.status, cuerpo };
  }

  /** Pide una ruta, valida su forma y devuelve los datos si cumplen el esquema. */
  async function validar<S extends z.ZodTypeAny>(nombre: string, ruta: string, esquema: S): Promise<z.infer<S> | undefined> {
    try {
      const { status, cuerpo } = await pedir(ruta);
      if (status !== 200) {
        registrar(nombre, "falla", `HTTP ${status}${cuerpo?.detail ? `: ${JSON.stringify(cuerpo.detail).slice(0, 120)}` : ""}`);
        return undefined;
      }
      const r = esquema.safeParse(cuerpo);
      if (!r.success) {
        registrar(nombre, "falla", describirErrores(r.error));
        return undefined;
      }
      registrar(nombre, "ok");
      return r.data;
    } catch (e) {
      registrar(nombre, "falla", `sin respuesta (${(e as Error).message})`);
      return undefined;
    }
  }

  async function esperarCodigo(nombre: string, ruta: string, esperado: number, init?: RequestInit, conToken = true) {
    try {
      const { status } = await pedir(ruta, init, conToken);
      registrar(nombre, status === esperado ? "ok" : "falla", status === esperado ? undefined : `se esperaba ${esperado} y respondió ${status}`);
    } catch (e) {
      registrar(nombre, "falla", `sin respuesta (${(e as Error).message})`);
    }
  }

  // 1. Disponibilidad y CORS
  try {
    const r = await fetch(`${base}/cotizaciones`, {
      method: "OPTIONS",
      headers: { Origin: origen, "Access-Control-Request-Method": "GET", "Access-Control-Request-Headers": "authorization" },
    });
    const permitido = r.headers.get("access-control-allow-origin");
    const cabeceras = (r.headers.get("access-control-allow-headers") ?? "").toLowerCase();
    const ok = (permitido === origen || permitido === "*") && (cabeceras.includes("authorization") || cabeceras.includes("*"));
    registrar(`CORS permite ${origen} con Authorization`, ok ? "ok" : "falla", ok ? undefined : `Access-Control-Allow-Origin: ${permitido ?? "ausente"}; Allow-Headers: ${cabeceras || "ausente"}`);
  } catch (e) {
    registrar("La API responde", "falla", `no se pudo conectar a ${base} (${(e as Error).message})`);
    return resultados;
  }

  // 2. Autenticación
  await esperarCodigo("Sin token, /cotizaciones responde 401", "/cotizaciones", 401, undefined, false);
  const formulario = (u: string, p: string) => ({
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ username: u, password: p }).toString(),
  });
  await esperarCodigo("Login con contraseña incorrecta responde 401", "/auth/login", 401, formulario(email, `${password}-incorrecta`), false);

  const login = await pedir("/auth/login", formulario(email, password), false).catch(() => null);
  const t = E.TokenResponse.safeParse(login?.cuerpo);
  if (login?.status !== 200 || !t.success) {
    registrar("Login con credenciales válidas", "falla", login?.status !== 200 ? `HTTP ${login?.status}` : describirErrores(t.error!));
    return resultados;
  }
  token = t.data.access_token;
  registrar("Login con credenciales válidas", "ok");
  const exp = decodificarJwt(token)?.exp;
  registrar("El JWT incluye exp futuro", typeof exp === "number" && exp * 1000 > Date.now() ? "ok" : "falla", typeof exp === "number" ? undefined : "el token no trae el claim exp");

  await validar("GET /auth/me", "/auth/me", E.Usuario);
  await esperarCodigo("Token inválido responde 401", "/auth/me", 401, { headers: { Authorization: "Bearer token-invalido" } }, false);

  // 3. Catálogos y métricas
  const clientes = await validar("GET /clientes", "/clientes", E.ClienteResumen.array());
  const anios = await validar("GET /metricas/anios", "/metricas/anios", E.Anios);
  const resumen = await validar("GET /metricas/resumen", "/metricas/resumen", E.MetricasResumen);
  const porAnio = await validar("GET /metricas/por-periodo?granularidad=anio", "/metricas/por-periodo?granularidad=anio", E.MetricasPorPeriodo);

  if (resumen && porAnio) {
    const suma = porAnio.reduce((s, p) => s + p.monto_neto, 0);
    const cantidad = porAnio.reduce((s, p) => s + p.cantidad, 0);
    const ok = suma === resumen.monto_neto_total && cantidad === resumen.total_cotizaciones;
    registrar("La serie anual cuadra con el resumen", ok ? "ok" : "falla", ok ? undefined : `serie: ${cantidad} cotizaciones / $${suma}; resumen: ${resumen.total_cotizaciones} / $${resumen.monto_neto_total}`);
  }

  const anio = anios?.[0];
  if (anio) {
    const resumenAnio = await validar(`GET /metricas/resumen?anio=${anio}`, `/metricas/resumen?anio=${anio}`, E.MetricasResumen);
    const meses = await validar(`GET /metricas/por-periodo?anio=${anio}&granularidad=mes`, `/metricas/por-periodo?anio=${anio}&granularidad=mes`, E.MetricasPorPeriodo);
    if (resumenAnio && meses) {
      const suma = meses.reduce((s, p) => s + p.monto_neto, 0);
      const formato = meses.every((m) => m.periodo.startsWith(`${anio}-`) && m.periodo.length === 7);
      registrar(`La serie mensual de ${anio} cuadra con el resumen`, suma === resumenAnio.monto_neto_total && formato ? "ok" : "falla", formato ? undefined : 'los períodos deben ser "YYYY-MM" del año pedido');
    }
    const listaAnio = await validar(`GET /cotizaciones?anio=${anio}`, `/cotizaciones?anio=${anio}&page_size=100`, E.PaginaCotizaciones);
    if (listaAnio && resumenAnio) {
      const fueraDelAnio = listaAnio.items.filter((c) => !c.fecha.startsWith(`${anio}-`)).length;
      registrar(`El filtro por año devuelve solo ${anio}`, fueraDelAnio === 0 ? "ok" : "falla", fueraDelAnio ? `${fueraDelAnio} cotizaciones de otro año` : undefined);
      registrar("El total del listado coincide con el resumen", listaAnio.total === resumenAnio.total_cotizaciones ? "ok" : "falla", `listado ${listaAnio.total}, resumen ${resumenAnio.total_cotizaciones}`);
    }
  } else {
    registrar("Filtros por año", "advertencia", "no hay años con cotizaciones para probar");
  }

  // 4. Listado, orden, paginación y filtro por cliente
  const p1 = await validar("GET /cotizaciones", "/cotizaciones?page=1&page_size=20", E.PaginaCotizaciones);
  if (p1 && p1.items.length > 0) {
    const fechas = p1.items.map((c) => c.fecha);
    registrar("El listado viene ordenado por fecha descendente", fechas.every((f, i) => i === 0 || f <= fechas[i - 1]!) ? "ok" : "falla");
    if (p1.total > 20) {
      const p2 = await validar("GET /cotizaciones?page=2", "/cotizaciones?page=2&page_size=20", E.PaginaCotizaciones);
      if (p2) {
        const repetidos = p2.items.filter((c) => p1.items.some((x) => x.id === c.id)).length;
        registrar("Las páginas no repiten registros", repetidos === 0 ? "ok" : "falla", repetidos ? `${repetidos} repetidos entre la página 1 y 2` : undefined);
      }
    }
    const cliente = p1.items[0]!.cliente;
    const deCliente = await validar("GET /cotizaciones?cliente_id", `/cotizaciones?cliente_id=${cliente.id}&page_size=100`, E.PaginaCotizaciones);
    if (deCliente) registrar("El filtro por cliente devuelve solo ese cliente", deCliente.items.every((c) => c.cliente.id === cliente.id) ? "ok" : "falla");
    if (clientes && !clientes.some((c) => c.id === cliente.id)) registrar("Los clientes del listado existen en /clientes", "falla", `falta el cliente ${cliente.id}`);

    const primera = p1.items[0]!;
    const termino = encodeURIComponent(primera.numero);
    const busqueda = await validar("GET /cotizaciones?q=<número>", `/cotizaciones?q=${termino}`, E.PaginaCotizaciones);
    if (busqueda) registrar("La búsqueda por número encuentra la cotización", busqueda.items.some((c) => c.id === primera.id) ? "ok" : "falla");

    const detalle = await validar("GET /cotizaciones/{id}", `/cotizaciones/${primera.id}`, E.CotizacionDetalle);
    if (detalle) {
      registrar("Total = neto + IVA", detalle.total === detalle.monto_neto + detalle.iva ? "ok" : "advertencia", `${detalle.numero}: ${detalle.total} vs ${detalle.monto_neto + detalle.iva}`);
      const sumaItems = detalle.items.reduce((s, it) => s + it.subtotal, 0);
      registrar("La suma de ítems coincide con el neto", Math.abs(sumaItems - detalle.monto_neto) <= 1 ? "ok" : "advertencia", `${detalle.numero}: ítems ${sumaItems}, neto ${detalle.monto_neto}`);
    }
  } else if (p1) {
    registrar("Listado con datos", "advertencia", "la base no tiene cotizaciones; se omiten las pruebas de detalle y filtros");
  }

  // 5. Errores
  await esperarCodigo("Cotización inexistente responde 404", "/cotizaciones/999999999", 404);
  await esperarCodigo("Parámetro inválido responde 422", "/cotizaciones?anio=abc", 422);

  return resultados;
}
