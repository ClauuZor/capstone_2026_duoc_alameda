import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { crearTokenMock } from "./api/mock/mockClient";
import { setToken } from "./auth/token";
import { renderApp } from "./test/renderApp";

const conSesion = () => setToken(crearTokenMock("demo@cotiza.test"));

async function iniciarSesion(email = "demo@cotiza.test", password = "demo1234") {
  const user = userEvent.setup();
  await user.type(await screen.findByLabelText("Correo"), email);
  await user.type(screen.getByLabelText("Contraseña"), password);
  await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));
  return user;
}

describe("Épica 002 · autenticación y protección de la información", () => {
  it("CP-F01: sin sesión redirige al login y vuelve a la ruta pedida después de entrar", async () => {
    const { router } = renderApp("/cotizaciones?anio=2025");
    expect(await screen.findByRole("button", { name: "Iniciar sesión" })).toBeInTheDocument();
    await iniciarSesion();
    expect(await screen.findByRole("heading", { name: "Cotizaciones" })).toBeInTheDocument();
    expect(router.state.location.search).toBe("?anio=2025");
  });

  it("CP-F02: credenciales incorrectas muestran un error sin revelar cuál falló", async () => {
    renderApp("/");
    await iniciarSesion("demo@cotiza.test", "incorrecta");
    expect(await screen.findByRole("alert")).toHaveTextContent("Correo o contraseña incorrectos.");
  });

  it("CP-F03: formulario vacío se valida sin llamar a la API", async () => {
    renderApp("/login");
    await userEvent.setup().click(await screen.findByRole("button", { name: "Iniciar sesión" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Ingresa tu correo y tu contraseña.");
  });

  it("CP-F04: con un token vencido vuelve al login avisando que la sesión expiró", async () => {
    setToken(crearTokenMock("demo@cotiza.test", -5_000));
    renderApp("/");
    expect(await screen.findByText("Tu sesión expiró. Inicia sesión nuevamente.")).toBeInTheDocument();
  });

  it("CP-F08: cerrar sesión borra el token y vuelve al login", async () => {
    conSesion();
    renderApp("/");
    const botones = await screen.findAllByRole("button", { name: "Cerrar sesión" });
    await userEvent.setup().click(botones[0] as HTMLElement);
    expect(await screen.findByRole("button", { name: "Iniciar sesión" })).toBeInTheDocument();
    expect(sessionStorage.getItem("cotizaplus.token")).toBeNull();
  });
});

describe("Épica 002 · búsquedas y filtros por cliente y año", () => {
  beforeEach(conSesion);

  it("CP-F09: filtrar por año deja solo cotizaciones de ese año y lo refleja en la URL", async () => {
    const { router } = renderApp("/cotizaciones");
    const user = userEvent.setup();
    await screen.findByRole("table");
    await waitFor(() => expect(screen.getByLabelText("Año").querySelectorAll("option").length).toBeGreaterThan(1));
    await user.selectOptions(screen.getByLabelText("Año"), "2024");
    await waitFor(() => expect(router.state.location.search).toBe("?anio=2024"));
    await waitFor(() => {
      const filas = within(screen.getByRole("table")).getAllByRole("row").slice(1);
      expect(filas.every((f) => f.textContent?.includes("2024"))).toBe(true);
    });
  });

  it("CP-F09: filtrar por cliente deja solo sus cotizaciones", async () => {
    renderApp("/cotizaciones");
    const user = userEvent.setup();
    await screen.findByRole("table");
    await waitFor(() => expect(screen.getByLabelText("Cliente").querySelectorAll("option").length).toBeGreaterThan(1));
    await user.selectOptions(screen.getByLabelText("Cliente"), "Hotel Bahía Serena");
    await waitFor(() => {
      const filas = within(screen.getByRole("table")).getAllByRole("row").slice(1);
      expect(filas.length).toBeGreaterThan(0);
      expect(filas.every((f) => f.textContent?.includes("Hotel Bahía Serena"))).toBe(true);
    });
  });

  it("CP-F10: la búsqueda espera a que se deje de escribir y actualiza la URL", async () => {
    const { router } = renderApp("/cotizaciones");
    await screen.findByRole("table");
    await userEvent.setup().type(screen.getByLabelText("Buscar"), "bahia");
    await waitFor(() => expect(router.state.location.search).toBe("?q=bahia"));
    await waitFor(() => {
      const filas = within(screen.getByRole("table")).getAllByRole("row").slice(1);
      expect(filas.every((f) => f.textContent?.includes("Hotel Bahía Serena"))).toBe(true);
    });
  });

  it("CP-F11: sin resultados muestra un estado vacío con acción para limpiar filtros", async () => {
    renderApp("/cotizaciones?q=no-existe-nada");
    expect(await screen.findByText("Ninguna cotización coincide con estos filtros")).toBeInTheDocument();
    const limpiar = screen.getAllByRole("button", { name: "Limpiar filtros" });
    await userEvent.setup().click(limpiar[limpiar.length - 1] as HTMLElement);
    expect(await screen.findByRole("table")).toBeInTheDocument();
  });

  it("pagina el listado", async () => {
    renderApp("/cotizaciones");
    await screen.findByRole("table");
    expect(screen.getByText(/^1–20 de/)).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Siguiente" }));
    expect(await screen.findByText(/^21–40 de/)).toBeInTheDocument();
  });
});

describe("Épica 002 · detalle de cotización", () => {
  beforeEach(conSesion);

  it("muestra ítems, totales y el documento de origen", async () => {
    renderApp("/cotizaciones/1");
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(/^COT-2024-\d{4}$/);
    expect(screen.getByRole("rowheader", { name: "IVA (19 %)" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /abrir en Google Drive/ })).toHaveAttribute("target", "_blank");
  });

  it("CP-F18: informa cuando la cotización no existe", async () => {
    renderApp("/cotizaciones/999999");
    expect(await screen.findByText("No encontramos esta cotización")).toBeInTheDocument();
  });
});

describe("Épica 002 · dashboard y métricas", () => {
  beforeEach(conSesion);

  it("CP-F13: muestra total de cotizaciones, clientes únicos y montos del año", async () => {
    renderApp("/?anio=2025");
    const indicadores = await screen.findByRole("region", { name: "Indicadores" });
    for (const etiqueta of ["Cotizaciones", "Clientes únicos", "Monto cotizado", "Monto promedio"]) {
      expect(within(indicadores).getByText(etiqueta)).toBeInTheDocument();
    }
    expect(screen.getByRole("heading", { name: "Monto cotizado por mes, 2025" })).toBeInTheDocument();
  });

  it("la tabla accesible del gráfico tiene los 12 meses de un año cerrado", async () => {
    renderApp("/?anio=2025");
    const tabla = await screen.findByRole("table", { name: "Monto cotizado por mes, 2025" });
    expect(within(tabla).getAllByRole("row")).toHaveLength(13);
  });

  it("filtrar el resumen por cliente enlaza al listado con los mismos filtros", async () => {
    const { router } = renderApp("/?anio=2025");
    const user = userEvent.setup();
    await screen.findByRole("region", { name: "Indicadores" });
    await waitFor(() => expect(screen.getByLabelText("Cliente").querySelectorAll("option").length).toBeGreaterThan(1));
    await user.selectOptions(screen.getByLabelText("Cliente"), "Hotel Bahía Serena");
    const enlace = await screen.findByRole("link", { name: /cotizaciones? en 2025 de Hotel Bahía Serena/ });
    await user.click(enlace);
    await waitFor(() => expect(router.state.location.pathname).toBe("/cotizaciones"));
    expect(router.state.location.search).toBe("?cliente_id=6&anio=2025");
  });

  it("Todos los años cambia el gráfico a montos por año", async () => {
    renderApp("/?anio=todos");
    expect(await screen.findByRole("heading", { name: "Monto cotizado por año" })).toBeInTheDocument();
  });
});

describe("robustez", () => {
  beforeEach(conSesion);

  it("cada pantalla pone su propio título en la pestaña", async () => {
    renderApp("/cotizaciones");
    await screen.findByRole("heading", { name: "Cotizaciones" });
    expect(document.title).toBe("Cotizaciones · Cotiza+");
  });

  it("CP-F23: si una pantalla falla al renderizar muestra un mensaje en vez de quedar en blanco", async () => {
    const original = console.error;
    console.error = () => {};
    const { mockClient } = await import("./api/mock/mockClient");
    // Respuesta que no respeta el contrato: sin "items".
    const espia = vi.spyOn(mockClient, "obtenerCotizacion").mockResolvedValue({ id: 1, numero: "X", fecha: "2026-01-01" } as never);
    renderApp("/cotizaciones/1");
    expect(await screen.findByText("Algo falló al mostrar esta pantalla")).toBeInTheDocument();
    espia.mockRestore();
    console.error = original;
  });
});
