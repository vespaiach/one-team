import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  date,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";

const sortOrder = customType<{ data: string }>({
  dataType() {
    return `text collate "C"`;
  },
});

export const user = pgTable(
  "user",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    avatarUrl: text("avatar_url"),
    role: text("role").notNull().default("member"),
    jobTitle: text("job_title"),
    slackHandle: text("slack_handle"),
    phone: text("phone"),
    bio: text("bio"),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    mustChangePassword: boolean("must_change_password").notNull().default(false),
    feedFilter: text("feed_filter").notNull().default("all"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("user_email_lower_idx").on(sql`lower(${table.email})`),
    check("user_first_name_length", sql`char_length(${table.firstName}) <= 200`),
    check("user_last_name_length", sql`char_length(${table.lastName}) <= 200`),
    check("user_email_length", sql`char_length(${table.email}) <= 200`),
    check("user_avatar_url_length", sql`char_length(${table.avatarUrl}) <= 2000`),
    check("user_role_valid", sql`${table.role} in ('admin', 'member')`),
    check("user_job_title_length", sql`char_length(${table.jobTitle}) <= 200`),
    check("user_slack_handle_length", sql`char_length(${table.slackHandle}) <= 200`),
    check("user_phone_length", sql`char_length(${table.phone}) <= 200`),
    check("user_bio_length", sql`char_length(${table.bio}) <= 10000`),
    check("user_feed_filter_valid", sql`${table.feedFilter} in ('comments', 'all')`),
  ],
);

export const credential = pgTable(
  "credential",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: uuid("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [check("credential_password_hash_length", sql`char_length(${table.passwordHash}) <= 255`)],
);

export const session = pgTable(
  "session",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tokenDigest: text("token_digest").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address").notNull(),
  },
  (table) => [
    index("session_user_id_idx").on(table.userId),
    index("session_expires_at_idx").on(table.expiresAt),
    check("session_token_digest_length", sql`char_length(${table.tokenDigest}) = 64`),
    check("session_user_agent_length", sql`char_length(${table.userAgent}) <= 1000`),
    check("session_ip_address_length", sql`char_length(${table.ipAddress}) <= 45`),
  ],
);

export const resetToken = pgTable(
  "reset_token",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tokenDigest: text("token_digest").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("reset_token_user_id_idx").on(table.userId),
    check("reset_token_token_digest_length", sql`char_length(${table.tokenDigest}) = 64`),
  ],
);

export const invite = pgTable(
  "invite",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    email: text("email").notNull(),
    invitedBy: uuid("invited_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tokenDigest: text("token_digest").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("invite_email_lower_unspent_idx")
      .on(sql`lower(${table.email})`)
      .where(sql`${table.acceptedAt} is null`),
    check("invite_email_length", sql`char_length(${table.email}) <= 200`),
    check("invite_token_digest_length", sql`char_length(${table.tokenDigest}) = 64`),
  ],
);

export const authAttempt = pgTable(
  "auth_attempt",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    flow: text("flow").notNull(),
    kind: text("kind").notNull(),
    subject: text("subject").notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("auth_attempt_flow_kind_subject_attempted_at_idx").on(
      table.flow,
      table.kind,
      table.subject,
      table.attemptedAt,
    ),
    index("auth_attempt_attempted_at_idx").on(table.attemptedAt),
    check("auth_attempt_flow_valid", sql`${table.flow} in ('signin', 'reset')`),
    check("auth_attempt_kind_valid", sql`${table.kind} in ('email', 'ip')`),
    check("auth_attempt_subject_length", sql`char_length(${table.subject}) <= 200`),
  ],
);

export const project = pgTable(
  "project",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    key: text("key").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active"),
    startDate: date("start_date"),
    targetDate: date("target_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    check("project_key_pattern", sql`${table.key} ~ '^[A-Z][A-Z0-9]{0,7}$'`),
    check("project_key_length", sql`char_length(${table.key}) <= 200`),
    check("project_name_length", sql`char_length(${table.name}) <= 200`),
    check("project_description_length", sql`char_length(${table.description}) <= 10000`),
    check("project_status_valid", sql`${table.status} in ('active', 'archived')`),
    check(
      "project_dates_ordered",
      sql`${table.startDate} is null or ${table.targetDate} is null or ${table.targetDate} >= ${table.startDate}`,
    ),
  ],
);

export const projectMember = pgTable(
  "project_member",
  {
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.userId] })],
);

export const boardColumn = pgTable(
  "board_column",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: sortOrder("sort_order").notNull(),
    kind: text("kind").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("board_column_project_id_name_lower_idx").on(table.projectId, sql`lower(${table.name})`),
    unique("board_column_project_id_id_unique").on(table.projectId, table.id),
    check("board_column_name_length", sql`char_length(${table.name}) <= 200`),
    check("board_column_kind_valid", sql`${table.kind} in ('open', 'done', 'canceled')`),
  ],
);

export const issueCounter = pgTable("issue_counter", {
  id: uuid("id")
    .primaryKey()
    .$defaultFn(() => uuidv7()),
  projectId: uuid("project_id")
    .notNull()
    .unique()
    .references(() => project.id, { onDelete: "cascade" }),
  lastNumber: integer("last_number").notNull().default(0),
});

export const issue = pgTable(
  "issue",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    projectId: uuid("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    columnId: uuid("column_id").notNull(),
    priority: text("priority").notNull().default("none"),
    assigneeId: uuid("assignee_id").references(() => user.id),
    dueDate: date("due_date"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => user.id),
    sortOrder: sortOrder("sort_order").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    unique("issue_project_id_number_unique").on(table.projectId, table.number),
    foreignKey({
      name: "issue_project_id_column_id_fk",
      columns: [table.projectId, table.columnId],
      foreignColumns: [boardColumn.projectId, boardColumn.id],
    }),
    check("issue_title_length", sql`char_length(${table.title}) <= 200`),
    check("issue_description_length", sql`char_length(${table.description}) <= 10000`),
    check("issue_priority_valid", sql`${table.priority} in ('none', 'low', 'medium', 'high', 'urgent')`),
  ],
);

export const label = pgTable(
  "label",
  {
    id: uuid("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    uniqueIndex("label_name_lower_idx").on(sql`lower(${table.name})`),
    check("label_name_length", sql`char_length(${table.name}) <= 200`),
  ],
);

export const issueLabel = pgTable(
  "issue_label",
  {
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issue.id, { onDelete: "cascade" }),
    labelId: uuid("label_id")
      .notNull()
      .references(() => label.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.issueId, table.labelId] }),
    index("issue_label_label_id_idx").on(table.labelId),
  ],
);