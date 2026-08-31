import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import { PHASE_PRODUCTION_BUILD } from "next/constants.js";
import postgres from "postgres";
import * as schema from "./schema.ts";

if (!process.env.DATABASE_URL && process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD) {
  throw new Error("DATABASE_URL is not set");
}

export const client = postgres(process.env.DATABASE_URL ?? "postgres://build-time-placeholder/placeholder");

export const db = drizzle(client, { schema });