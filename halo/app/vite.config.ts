import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
export default defineConfig({
  root,
  plugins: [react()],
  css: { postcss: root },
  server: {
    port: 5173,
    fs: { allow: [fileURLToPath(new URL("..", import.meta.url))] },
    proxy: { "/v1": { target: "http://127.0.0.1:8787", ws: true } },
  },
  build: { outDir: "../dist", emptyOutDir: true },
});
