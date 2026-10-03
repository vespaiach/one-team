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
    env: {
      ...(testDatabaseUrl ? { DATABASE_URL: testDatabaseUrl } : {}),
      APP_URL: "http://localhost:3000",
      EMAIL_FROM: "tracklite@localhost",
      MAILPIT_HOST: "localhost",
      MAILPIT_PORT: "8025",
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["src/**/*.test.ts"],
          environment: "node",
          fileParallelism: false,
        },
      },
      {
        extends: true,
        test: {
          name: "components",
          include: ["src/**/*.test.tsx"],
          environment: "jsdom",
          setupFiles: ["scripts/setup-components.ts"],
        },
      },
    ],
  },
});