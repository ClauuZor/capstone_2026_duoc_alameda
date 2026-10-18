import { formatCLP, formatCLPCorto, formatFecha, formatPeriodo, plural } from "./format";

describe("formato", () => {
  it("formatea pesos chilenos sin decimales", () => {
    expect(formatCLP(1234567)).toBe("$1.234.567");
    expect(formatCLP(0)).toBe("$0");
  });

  it("abrevia montos grandes para ejes y cifras", () => {
    expect(formatCLPCorto(12_430_000)).toBe("$12,4 M");
    expect(formatCLPCorto(850_000)).toBe("$850 mil");
    expect(formatCLPCorto(1_204_000_000)).toBe("$1.204 M");
  });

  it("no corre la fecha un día por zona horaria (CP-F19)", () => {
    // new Date("2026-03-01") en Chile mostraría 28 feb.
    expect(formatFecha("2026-03-01")).toBe("1 mar 2026");
    expect(formatFecha("2025-12-31")).toBe("31 dic 2025");
  });

  it("formatea períodos mensuales y anuales", () => {
    expect(formatPeriodo("2026-09")).toBe("sept");
    expect(formatPeriodo("2026-09", true)).toBe("sept 2026");
    expect(formatPeriodo("2025")).toBe("2025");
  });

  it("pluraliza", () => {
    expect(plural(1, "cotización", "cotizaciones")).toBe("1 cotización");
    expect(plural(1500, "cotización", "cotizaciones")).toBe("1.500 cotizaciones");
  });
});
