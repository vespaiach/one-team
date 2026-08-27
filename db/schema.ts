import { pgTable, serial, timestamp } from "drizzle-orm/pg-core";

// Placeholder table to verify the Drizzle + Postgres pipeline (generate → migrate → query).
// Delete once real domain tables are added.
export const setupCheck = pgTable("setup_check", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});