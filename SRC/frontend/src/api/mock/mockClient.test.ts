import { setToken } from "../../auth/token";
import { registrarManejadorNoAutorizado } from "../errors";
import type { CotizacionResumen } from "../types";
import { crearTokenMock, mockClient } from "./mockClient";

const conSesion = () => setToken(crearTokenMock("demo@cotiza.test"));

async function todas(filtros: { anio?: number; cliente_id?: number; q?: string }) {
  const acumulado: CotizacionResumen[] = [];
  for (let page = 1; ; page++) {
    const p = await mockClient.listarCotizaciones({ ...filtros, page, page_size: 50 });
    acumulado.push(...p.items);
    if (acumulado.length >= p.total) return acumulado;
  }
}

describe("cliente simulado (mismas reglas que exige el contrato)", () => {
  it("exige sesión: 401 sin token y con token vencido", async () => {
    await expect(mockClient.listarClientes()).rejects.toMatchObject({ status: 401 });
    setToken(crearTokenMock("demo@cotiza.test", -1));
    await expect(mockClient.listarClientes()).rejects.toMatchObject({ status: 401 });
  });

  it("avisa a la sesión cuando la API responde 401 (CP-F05)", async () => {
    const alExpirar = vi.fn();
    registrarManejadorNoAutorizado(alExpirar);
    await expect(mockClient.metricasResumen({})).rejects.toMatchObject({ status: 401 });
    expect(alExpirar).toHaveBeenCalledTimes(1);
    registrarManejadorNoAutorizado(null);
  });

  it("rechaza credenciales incorrectas", async () => {
    await expect(mockClient.login("demo@cotiza.test", "otra")).rejects.toMatchObject({ status: 401 });
  });

  it("filtra por año y cliente (CP-F09)", async () => {
    conSesion();
    const lista = await todas({ anio: 2025, cliente_id: 1 });
    expect(lista.length).toBeGreaterThan(0);
    expect(lista.every((c) => c.fecha.startsWith("2025-") && c.cliente.id === 1)).toBe(true);
  });

  it("busca por número, por nombre sin tildes y por RUT (CP-F10)", async () => {
    conSesion();
    const porNombre = await todas({ q: "bahia serena" });
    expect(porNombre.length).toBeGreaterThan(0);
    expect(porNombre.every((c) => c.cliente.nombre === "Hotel Bahía Serena")).toBe(true);

    const una = porNombre[0]!;
    expect((await todas({ q: una.numero.toLowerCase() })).map((c) => c.id)).toEqual([una.id]);
    expect((await todas({ q: una.cliente.rut! })).every((c) => c.cliente.id === una.cliente.id)).toBe(true);
  });

  it("ordena por fecha descendente", async () => {
    conSesion();
    const fechas = (await mockClient.listarCotizaciones({ page: 1, page_size: 50 })).items.map((c) => c.fecha);
    expect(fechas).toEqual([...fechas].sort().reverse());
  });

  it("las métricas cuadran con el listado y la serie mensual con el total (CP-F14)", async () => {
    conSesion();
    const lista = await todas({ anio: 2025 });
    const resumen = await mockClient.metricasResumen({ anio: 2025 });
    expect(resumen.total_cotizaciones).toBe(lista.length);
    expect(resumen.monto_neto_total).toBe(lista.reduce((s, c) => s + c.monto_neto, 0));
    expect(resumen.clientes_unicos).toBe(new Set(lista.map((c) => c.cliente.id)).size);

    const meses = await mockClient.metricasPorPeriodo({ anio: 2025, granularidad: "mes" });
    expect(meses.reduce((s, m) => s + m.monto_neto, 0)).toBe(resumen.monto_neto_total);
    expect(meses.reduce((s, m) => s + m.cantidad, 0)).toBe(resumen.total_cotizaciones);
  });

  it("pagina sin repetir ni perder registros (CP-F17)", async () => {
    conSesion();
    const lista = await todas({});
    expect(new Set(lista.map((c) => c.id)).size).toBe(lista.length);
  });

  it("los montos de cada cotización son consistentes", async () => {
    conSesion();
    const c = await mockClient.obtenerCotizacion(1);
    expect(c.items.reduce((s, it) => s + it.subtotal, 0)).toBe(c.monto_neto);
    expect(c.total).toBe(c.monto_neto + c.iva);
  });

  it("devuelve 404 para una cotización inexistente", async () => {
    conSesion();
    await expect(mockClient.obtenerCotizacion(999_999)).rejects.toMatchObject({ status: 404 });
  });
});
