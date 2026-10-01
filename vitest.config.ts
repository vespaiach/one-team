import { existsSync } from "node:fs";
import { defineConfig } from "vitest/config";

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

export default defineConfig({
  oxc: {
    jsx: { runtime: "automatic" },
  },
  test: {
    globalSetup: ["scripts/prepare-test-db.ts"],
    env: testDatabaseUrl ? { DATABASE_URL: testDatabaseUrl } : {},
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        extends: true,
        test: {
          name: "components",
          include: ["src/**/*.test.tsx"],
          environment: "jsdom",
          css: { include: [/\.module\.css$/] },
          setupFiles: ["scripts/setup-components.ts"],
        },
      },
    ],
  },
});
