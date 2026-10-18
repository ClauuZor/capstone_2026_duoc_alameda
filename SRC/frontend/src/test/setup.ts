import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach } from "vitest";
import { setToken } from "../auth/token";

// Recharts usa ResizeObserver, que jsdom no implementa.
class ResizeObserverFalso {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverFalso as unknown as typeof ResizeObserver;

beforeEach(() => {
  setToken(null);
  // Las pruebas de integración corren en entorno Node, sin sessionStorage.
  if (typeof sessionStorage !== "undefined") sessionStorage.clear();
});
afterEach(() => cleanup());
