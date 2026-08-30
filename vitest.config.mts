import { fileURLToPath } from "node:url";
import nextEnv from "@next/env";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

nextEnv.loadEnvConfig(process.cwd());

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src/", import.meta.url)),
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
  test: {
    exclude: ["node_modules/**", ".next/**", "drizzle/**"],
    projects: [
      {
        extends: true,
        test: {
          name: "server",
          environment: "node",
          include: ["**/*.test.ts"],
          globalSetup: ["./src/db/test-setup.ts"],
          setupFiles: ["./src/db/test-env-setup.ts"],
          fileParallelism: false,
        },
      },
      {
        extends: true,
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["**/*.test.tsx"],
          setupFiles: ["./src/test-setup-ui.ts"],
        },
      },
    ],
  },
});