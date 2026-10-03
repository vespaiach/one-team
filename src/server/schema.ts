import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const members = pgTable(
  "members",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    email: text("email").notNull(),
    fullName: text("full_name").notNull(),
    username: text("username").notNull(),
    role: text("role", { enum: ["admin", "member"] }).notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("members_role_check", sql`${table.role} in ('admin', 'member')`),
    uniqueIndex("members_email_key").on(sql`lower(${table.email})`),
    uniqueIndex("members_username_key").on(sql`lower(${table.username})`),
  ],
);

export const magicLinks = pgTable("magic_links", {
  id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
  memberId: bigint("member_id", { mode: "number" })
    .notNull()
    .references(() => members.id),
  tokenHash: text("token_hash").notNull().unique("magic_links_token_hash_key"),
  destination: text("destination"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable(
  "sessions",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    memberId: bigint("member_id", { mode: "number" })
      .notNull()
      .references(() => members.id),
    tokenHash: text("token_hash").notNull().unique("sessions_token_hash_key"),
    magicLinkId: bigint("magic_link_id", { mode: "number" }).references(() => magicLinks.id, {
      onDelete: "set null",
    }),
    requestId: uuid("request_id").notNull().unique("sessions_request_id_key"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastActiveAt: timestamp("last_active_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (table) => [index("sessions_member_id_idx").on(table.memberId)],
);

export const signInRequests = pgTable("sign_in_requests", {
  requestId: uuid("request_id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const signInAttempts = pgTable(
  "sign_in_attempts",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    emailKey: text("email_key").notNull(),
    ip: text("ip").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("sign_in_attempts_email_key_created_at_idx").on(table.emailKey, table.createdAt),
    index("sign_in_attempts_ip_created_at_idx").on(table.ip, table.createdAt),
  ],
);