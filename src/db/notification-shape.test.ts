import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, comment, issue, notification, project, user } from "./schema";
import { ALL_TABLES, truncateAllTablesStatement } from "./tables";
import { testDb, testSql, truncateTestDatabase } from "./test-database";

beforeEach(async () => {
  await truncateTestDatabase();
});

type ColumnRow = {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
};

async function notificationColumns(): Promise<ColumnRow[]> {
  return testSql<ColumnRow[]>`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'notification'
  `;
}

function columnOf(columns: ColumnRow[], name: string): ColumnRow {
  const found = columns.find((column) => column.column_name === name);
  if (!found) {
    throw new Error(`column ${name} not found`);
  }
  return found;
}

async function insertUser(overrides: Partial<typeof user.$inferInsert> = {}) {
  const now = new Date();
  const [row] = await testDb
    .insert(user)
    .values({
      firstName: "Ada",
      lastName: "Lovelace",
      email: `ada-${crypto.randomUUID()}@example.com`,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning();
  if (!row) {
    throw new Error("insertUser produced no row");
  }
  return row;
}

async function seedIssue() {
  const now = new Date();
  const author = await insertUser();
  const [projectRow] = await testDb
    .insert(project)
    .values({
      key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      name: "Website Redesign",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!projectRow) {
    throw new Error("seedIssue produced no project");
  }
  const [columnRow] = await testDb
    .insert(boardColumn)
    .values({
      projectId: projectRow.id,
      name: "Backlog",
      kind: "open",
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!columnRow) {
    throw new Error("seedIssue produced no column");
  }
  const [issueRow] = await testDb
    .insert(issue)
    .values({
      projectId: projectRow.id,
      number: 1,
      title: "Fix the header",
      columnId: columnRow.id,
      createdBy: author.id,
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!issueRow) {
    throw new Error("seedIssue produced no issue");
  }
  const [commentRow] = await testDb
    .insert(comment)
    .values({
      authorId: author.id,
      body: "Looks good.",
      issueId: issueRow.id,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!commentRow) {
    throw new Error("seedIssue produced no comment");
  }
  const recipient = await insertUser({ firstName: "Grace", lastName: "Hopper" });
  return { author, recipient, projectRow, issueRow, commentRow };
}

describe("notification table columns (FR-001, FR-002, FR-005, FR-007, research A-2)", () => {
  it("has exactly the twelve specified columns", async () => {
    const columns = await notificationColumns();
    const names = columns.map((column) => column.column_name).sort();
    expect(names).toEqual(
      [
        "id",
        "user_id",
        "actor_id",
        "type",
        "issue_id",
        "project_id",
        "comment_id",
        "read_at",
        "emailed_at",
        "send_attempts",
        "created_at",
        "updated_at",
      ].sort(),
    );
  });

  it.each([
    "id",
    "user_id",
    "actor_id",
    "issue_id",
    "project_id",
    "comment_id",
  ])("%s is a uuid", async (column) => {
    const columns = await notificationColumns();
    expect(columnOf(columns, column).data_type).toBe("uuid");
  });

  it("type is text, never a native enum", async () => {
    const columns = await notificationColumns();
    expect(columnOf(columns, "type").data_type).toBe("text");
  });

  it.each(["read_at", "emailed_at", "created_at", "updated_at"])("%s is timestamptz", async (column) => {
    const columns = await notificationColumns();
    expect(columnOf(columns, column).data_type).toBe("timestamp with time zone");
  });

  it.each([
    "id",
    "user_id",
    "actor_id",
    "type",
    "send_attempts",
    "created_at",
    "updated_at",
  ])("%s is NOT NULL", async (column) => {
    const columns = await notificationColumns();
    expect(columnOf(columns, column).is_nullable).toBe("NO");
  });

  it.each([
    "issue_id",
    "project_id",
    "comment_id",
    "read_at",
    "emailed_at",
  ])("%s is nullable", async (column) => {
    const columns = await notificationColumns();
    expect(columnOf(columns, column).is_nullable).toBe("YES");
  });

  it("send_attempts is integer DEFAULT 0 NOT NULL", async () => {
    const columns = await notificationColumns();
    const sendAttempts = columnOf(columns, "send_attempts");
    expect(sendAttempts.data_type).toBe("integer");
    expect(sendAttempts.is_nullable).toBe("NO");
    expect(sendAttempts.column_default).toBe("0");
  });

  it("id has no database default and is generated by the server as a uuidv7", async () => {
    const columns = await notificationColumns();
    expect(columnOf(columns, "id").column_default).toBeNull();

    const seeded = await seedIssue();
    const now = new Date();
    const [row] = await testDb
      .insert(notification)
      .values({
        userId: seeded.recipient.id,
        actorId: seeded.author.id,
        type: "assignment",
        issueId: seeded.issueRow.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!row) {
      throw new Error("insert produced no notification");
    }
    expect(row.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(row.sendAttempts).toBe(0);
  });

  it("adds no pgEnum type to the public schema", async () => {
    const enums = await testSql<{ typname: string }[]>`
      SELECT typname FROM pg_type WHERE typtype = 'e'
    `;
    expect(enums).toHaveLength(0);
  });
});

describe("notification indexes (FR-006, FR-008, research A-4)", () => {
  async function indexDefinitions(): Promise<Map<string, string>> {
    const rows = await testSql<{ indexname: string; indexdef: string }[]>`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'notification'
    `;
    return new Map(rows.map((row) => [row.indexname, row.indexdef]));
  }

  it("carries exactly the primary key and the three specified indexes", async () => {
    const definitions = await indexDefinitions();
    expect([...definitions.keys()].sort()).toEqual(
      [
        "notification_pkey",
        "notification_user_id_created_at_idx",
        "notification_user_id_unread_idx",
        "notification_user_id_comment_id_idx",
      ].sort(),
    );
  });

  it("indexes (user_id, created_at) for the newest-first list", async () => {
    const definition = (await indexDefinitions()).get("notification_user_id_created_at_idx");
    expect(definition).toContain("(user_id, created_at)");
    expect(definition).not.toContain("WHERE");
  });

  it("indexes user_id partially, WHERE read_at IS NULL", async () => {
    const definition = (await indexDefinitions()).get("notification_user_id_unread_idx");
    expect(definition).toContain("(user_id)");
    expect(definition).toContain("WHERE (read_at IS NULL)");
  });

  it("indexes (user_id, comment_id) uniquely and partially, WHERE comment_id IS NOT NULL", async () => {
    const definition = (await indexDefinitions()).get("notification_user_id_comment_id_idx");
    expect(definition).toContain("CREATE UNIQUE INDEX");
    expect(definition).toContain("(user_id, comment_id)");
    expect(definition).toContain("WHERE (comment_id IS NOT NULL)");
  });
});

describe("notification foreign keys (FR-058, FR-059, FR-060, research A-5, C-1)", () => {
  async function foreignKeyDefinitions(): Promise<string[]> {
    const rows = await testSql<{ definition: string }[]>`
      SELECT pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid = 'notification'::regclass AND contype = 'f'
    `;
    return rows.map((row) => row.definition);
  }

  function definitionFor(definitions: string[], column: string): string {
    const found = definitions.find((definition) => definition.startsWith(`FOREIGN KEY (${column})`));
    if (!found) {
      throw new Error(`no foreign key on ${column}`);
    }
    return found;
  }

  it("declares five foreign keys", async () => {
    expect(await foreignKeyDefinitions()).toHaveLength(5);
  });

  it.each(["issue_id", "project_id", "comment_id"])("cascades the delete of %s's parent", async (column) => {
    const definitions = await foreignKeyDefinitions();
    expect(definitionFor(definitions, column)).toContain("ON DELETE CASCADE");
  });

  it.each(["user_id", "actor_id"])("gives %s no ON DELETE clause", async (column) => {
    const definitions = await foreignKeyDefinitions();
    expect(definitionFor(definitions, column)).not.toContain("ON DELETE");
  });
});

describe("notification is known to the test harness (research A-6)", () => {
  it("is listed in ALL_TABLES", () => {
    expect(ALL_TABLES).toContain("notification");
  });

  it("is named by truncateAllTablesStatement()", () => {
    expect(truncateAllTablesStatement()).toContain('"notification"');
  });
});