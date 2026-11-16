import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { crearTokenMock } from "../api/mock/mockClient";
import { setToken } from "../auth/token";
import { renderApp } from "../test/renderApp";

beforeEach(() => setToken(crearTokenMock("demo@cotiza.test")));

describe("Épica 001 · conexión con Google Drive", () => {
  it("informa el motivo cuando la conexión con Google falla", async () => {
    renderApp("/drive?drive=error&motivo=cancelado");
    expect(await screen.findByRole("alert")).toHaveTextContent("No se otorgó acceso a Google Drive.");
  });

  it("conecta Drive, define la carpeta, sincroniza y lista los documentos", async () => {
    const user = userEvent.setup();
    renderApp("/drive");

    expect(await screen.findByRole("heading", { name: "Google Drive", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Sin conectar")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sincronizar ahora" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Conectar Google Drive" }));
    expect(await screen.findByText("Google Drive conectado")).toBeInTheDocument();
    expect(await screen.findByText("Conectado")).toBeInTheDocument();

    const carpeta = screen.getByLabelText("Enlace o ID de la carpeta");
    await user.type(carpeta, "no válido");
    await user.click(screen.getByRole("button", { name: "Guardar carpeta" }));
    expect(await screen.findByText(/No es un ID ni un enlace válido/)).toBeInTheDocument();

    await user.clear(carpeta);
    await user.type(carpeta, "https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp?usp=sharing");
    await user.click(screen.getByRole("button", { name: "Guardar carpeta" }));
    expect(await screen.findByText("Carpeta guardada.")).toBeInTheDocument();
    expect(carpeta).toHaveValue("1AbCdEfGhIjKlMnOp");

    await user.click(screen.getByRole("button", { name: "Sincronizar ahora" }));
    expect(await screen.findByLabelText("Resultado de la sincronización")).toBeInTheDocument();

    const tabla = await screen.findByRole("table");
    expect(within(tabla).getByText("Cotizacion_COT-2024-0192.pdf")).toBeInTheDocument();
    expect(within(tabla).getAllByRole("link", { name: "Ver cotización" })).toHaveLength(2);

    await user.selectOptions(screen.getByLabelText("Estado"), "error");
    expect(await screen.findByText(/no contiene texto seleccionable/)).toBeInTheDocument();
    expect(screen.queryByText("Cotizacion_COT-2024-0192.pdf")).not.toBeInTheDocument();
  });
});
