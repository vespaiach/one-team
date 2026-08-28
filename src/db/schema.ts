import { pgTable, serial, timestamp } from "drizzle-orm/pg-core";

export const setupCheck = pgTable("setup_check", {
  id: serial("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});