import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Simulation of several rounds on a real local Supabase stack (DAZBY-162): never part of `pnpm test`.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/sim/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 900_000,
    hookTimeout: 600_000,
  },
});
