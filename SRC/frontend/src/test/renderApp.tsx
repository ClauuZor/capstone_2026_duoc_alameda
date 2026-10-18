import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { crearQueryClient, rutas } from "../App";
import { AuthProvider } from "../auth/AuthContext";

/** Monta la aplicación completa (rutas, guards, autenticación y cliente mock) en una ruta inicial. */
export function renderApp(ruta = "/") {
  const router = createMemoryRouter(rutas, { initialEntries: [ruta], future: { v7_relativeSplatPath: true } });
  const queryClient = crearQueryClient();
  const utilidades = render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} future={{ v7_startTransition: true }} />
      </AuthProvider>
    </QueryClientProvider>,
  );
  return { ...utilidades, router };
}
