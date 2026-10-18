import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, createHashRouter, RouterProvider, type RouteObject } from "react-router-dom";
import { ApiError } from "./api/errors";
import { AuthProvider } from "./auth/AuthContext";
import { RequiereSesion } from "./auth/Guards";
import { ErrorInesperado } from "./components/ErrorInesperado";
import { Marco } from "./components/Marco";
import { config } from "./config";
import { CotizacionDetallePage } from "./pages/CotizacionDetallePage";
import { CotizacionesPage } from "./pages/CotizacionesPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LoginPage } from "./pages/LoginPage";
import { NoEncontradaPage } from "./pages/NoEncontradaPage";

export const rutas: RouteObject[] = [
  { path: "/login", element: <LoginPage />, errorElement: <ErrorInesperado /> },
  {
    path: "/",
    element: (
      <RequiereSesion>
        <Marco />
      </RequiereSesion>
    ),
    errorElement: <ErrorInesperado />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "cotizaciones", element: <CotizacionesPage /> },
      { path: "cotizaciones/:id", element: <CotizacionDetallePage /> },
      { path: "*", element: <NoEncontradaPage /> },
    ],
  },
];

export function crearQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        // Reintentar solo fallas de red o del servidor; un 4xx no se arregla reintentando.
        retry: (intentos, error) => intentos < 2 && error instanceof ApiError && (error.status === 0 || error.status >= 500),
      },
    },
  });
}

const queryClient = crearQueryClient();
const futuro = { v7_relativeSplatPath: true, v7_fetcherPersist: true, v7_normalizeFormMethod: true, v7_partialHydration: true, v7_skipActionErrorRevalidation: true };
const router = config.routerMode === "hash" ? createHashRouter(rutas, { future: futuro }) : createBrowserRouter(rutas, { future: futuro });

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} future={{ v7_startTransition: true }} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
