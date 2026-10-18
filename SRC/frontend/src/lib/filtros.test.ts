import { escribirFiltros, escribirFiltrosResumen, leerFiltros, leerFiltrosResumen, totalPaginas } from "./filtros";

describe("filtros del listado en la URL", () => {
  it("usa valores por defecto con la URL vacía", () => {
    expect(leerFiltros(new URLSearchParams())).toEqual({ q: undefined, cliente_id: undefined, anio: undefined, page: 1, page_size: 20 });
  });

  it("ignora valores inválidos o manipulados (CP-F12)", () => {
    expect(leerFiltros(new URLSearchParams("anio=abc&cliente_id=-3&page=0"))).toMatchObject({ anio: undefined, cliente_id: undefined, page: 1 });
  });

  it("ida y vuelta sin perder información, omitiendo la página 1", () => {
    const original = { q: "cordillera", cliente_id: 3, anio: 2025, page: 2, page_size: 20 };
    expect(leerFiltros(escribirFiltros(original))).toEqual(original);
    expect(escribirFiltros({ ...original, page: 1 }).toString()).toBe("q=cordillera&cliente_id=3&anio=2025");
  });

  it("calcula el total de páginas", () => {
    expect(totalPaginas(0, 20)).toBe(1);
    expect(totalPaginas(41, 20)).toBe(3);
  });
});

describe("filtros del resumen en la URL", () => {
  it("sin año en la URL usa el año en curso", () => {
    expect(leerFiltrosResumen(new URLSearchParams(), 2026)).toEqual({ anio: 2026, cliente_id: undefined });
  });

  it("anio=todos quita el filtro de año", () => {
    expect(leerFiltrosResumen(new URLSearchParams("anio=todos&cliente_id=4"), 2026)).toEqual({ anio: undefined, cliente_id: 4 });
  });

  it("no escribe el año en curso en la URL", () => {
    expect(escribirFiltrosResumen({ anio: 2026 }, 2026).toString()).toBe("");
    expect(escribirFiltrosResumen({ anio: 2025, cliente_id: 2 }, 2026).toString()).toBe("anio=2025&cliente_id=2");
    expect(escribirFiltrosResumen({}, 2026).toString()).toBe("anio=todos");
  });
});
