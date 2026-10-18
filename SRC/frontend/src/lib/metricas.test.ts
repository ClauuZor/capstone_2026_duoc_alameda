import { completarMeses, montoPromedio } from "./metricas";

describe("completarMeses (CP-F15)", () => {
  it("rellena con ceros los meses sin cotizaciones en un año cerrado", () => {
    const serie = completarMeses(2025, [{ periodo: "2025-03", cantidad: 2, monto_neto: 500 }], new Date(2026, 9, 5));
    expect(serie).toHaveLength(12);
    expect(serie[0]).toEqual({ periodo: "2025-01", cantidad: 0, monto_neto: 0 });
    expect(serie[2]).toEqual({ periodo: "2025-03", cantidad: 2, monto_neto: 500 });
  });

  it("no inventa meses futuros en el año en curso", () => {
    expect(completarMeses(2026, [], new Date(2026, 9, 5))).toHaveLength(10);
  });
});

describe("montoPromedio", () => {
  it("redondea a pesos enteros", () => expect(montoPromedio(1000, 3)).toBe(333));
  it("es 0 sin cotizaciones, sin dividir por cero", () => expect(montoPromedio(0, 0)).toBe(0));
});
