/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { viteSingleFile } from "vite-plugin-singlefile";

// `npm run build:demo` genera un único index.html autocontenido (modo mock + HashRouter)
// para compartir una demo navegable sin backend. El build normal no usa el plugin.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === "demo" ? [viteSingleFile()] : [])],
  build:
    mode === "demo"
      ? { outDir: "dist-demo" }
      : { outDir: "dist", rollupOptions: { output: { manualChunks: { graficos: ["recharts"], react: ["react", "react-dom", "react-router-dom", "@tanstack/react-query"] } } } },
  server: { port: 5173 },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
}));
