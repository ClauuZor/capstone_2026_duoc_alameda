import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { crearTokenMock } from "../api/mock/mockClient";
import { cotizaciones } from "../api/mock/datos";
import { setToken } from "../auth/token";
import { renderApp } from "../test/renderApp";

beforeEach(() => setToken(crearTokenMock("demo@cotiza.test")));

describe("Atributos comerciales: filtros, métricas y detalle", () => {
  it("filtra el listado por material y lo refleja en la URL", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/cotizaciones");
    await user.click(await screen.findByText("Más filtros"));
    const material = await screen.findByLabelText("Material");
    await waitFor(() => expect(within(material).getByRole("option", { name: "PVC" })).toBeInTheDocument());
    await user.selectOptions(material, "PVC");

    await waitFor(() => expect(router.state.location.search).toContain("material=PVC"));
    const esperadas = cotizaciones.filter((c) => c.material === "PVC").length;
    expect(await screen.findByText(new RegExp(`^${esperadas.toLocaleString("es-CL")} cotizaciones encontradas`))).toBeInTheDocument();
    const filas = within(screen.getByRole("table")).getAllByRole("row").slice(1);
    for (const fila of filas) expect(fila).toHaveTextContent("PVC");
  });

  it("el resumen muestra distribuciones y una fila abre el listado filtrado", async () => {
    const user = userEvent.setup();
    const { router } = renderApp("/?anio=todos");
    const porMaterial = await screen.findByRole("region", { name: "Por material" });
    const fila = await within(porMaterial).findByRole("button", { name: "Aluminio" });
    expect(await screen.findByText("Superficie cotizada")).toBeInTheDocument();
    await user.click(fila);
    await waitFor(() => expect(router.state.location.pathname).toBe("/cotizaciones"));
    expect(router.state.location.search).toContain("material=Aluminio");
  });

  it("el detalle muestra cliente, proyecto y condiciones", async () => {
    const c = cotizaciones.find((x) => x.material && x.vendedor) as (typeof cotizaciones)[number];
    renderApp(`/cotizaciones/${c.id}`);
    const proyecto = await screen.findByRole("heading", { name: "Proyecto" });
    expect(proyecto.parentElement).toHaveTextContent(c.material as string);
    expect(screen.getByRole("heading", { name: "Condiciones" }).parentElement).toHaveTextContent(c.vendedor as string);
  });
});
