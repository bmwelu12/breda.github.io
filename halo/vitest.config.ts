import { defineConfig } from "vitest/config";
export default defineConfig({ test: { include: ["server/test/**/*.test.ts", "sdk/**/*.test.ts"], environment: "node" } });
