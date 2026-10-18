import { config } from "../config";
import { httpClient } from "./http";
import { mockClient } from "./mock/mockClient";
import type { ApiClient } from "./types";

/** Punto único de acceso a datos. Cambiar VITE_API_MODE no requiere tocar componentes. */
export const api: ApiClient = config.apiMode === "http" ? httpClient : mockClient;
