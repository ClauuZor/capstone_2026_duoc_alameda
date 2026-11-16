export const config = {
  /** API real por defecto. Las pruebas y la demo de GitHub Pages (.env.demo) usan datos simulados. */
  /** Las pruebas siempre usan el mock, aunque exista un .env.local con VITE_API_MODE=http. */
  apiMode: import.meta.env.MODE === "test" || import.meta.env.VITE_API_MODE === "mock" ? "mock" : "http",
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, ""),
  routerMode: import.meta.env.VITE_ROUTER_MODE === "hash" ? "hash" : "browser",
  /** Latencia artificial del modo mock, para que los estados de carga sean visibles. */
  mockLatencyMs: import.meta.env.MODE === "test" ? 0 : 350,
} as const;
