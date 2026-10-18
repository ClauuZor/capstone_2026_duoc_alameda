export const config = {
  apiMode: import.meta.env.VITE_API_MODE === "http" ? "http" : "mock",
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, ""),
  routerMode: import.meta.env.VITE_ROUTER_MODE === "hash" ? "hash" : "browser",
  /** Latencia artificial del modo mock, para que los estados de carga sean visibles. */
  mockLatencyMs: import.meta.env.MODE === "test" ? 0 : 350,
} as const;
