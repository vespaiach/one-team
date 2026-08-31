import { describe, expect, it } from "vitest";
import { testSql } from "./test-database";

type ColumnRow = {
  column_name: string;
  data_type: string;
  column_default: string | null;
};

async function columnsOf(table: string): Promise<ColumnRow[]> {
  return testSql<ColumnRow[]>`
    SELECT column_name, data_type, column_default
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = ${table}
  `;
}

function columnOf(columns: ColumnRow[], name: string): ColumnRow {
  const found = columns.find((column) => column.column_name === name);
  if (!found) {
    throw new Error(`column ${name} not found`);
  }
  return found;
}

describe("schema conventions (FR-001, OT-DATA-001)", () => {
  const tables = ["user", "credential", "session", "reset_token", "auth_attempt"] as const;

  it.each(tables)("%s.id is a server-generated uuid with no database default", async (table) => {
    const columns = await columnsOf(table);
    const id = columnOf(columns, "id");
    expect(id.data_type).toBe("uuid");
    expect(id.column_default).toBeNull();
  });

  it.each([
    ["user", "role"],
    ["user", "feed_filter"],
    ["auth_attempt", "flow"],
    ["auth_attempt", "kind"],
  ] as const)("%s.%s is text with a CHECK, never a native enum", async (table, column) => {
    const columns = await columnsOf(table);
    expect(columnOf(columns, column).data_type).toBe("text");

    const checks = await testSql<{ definition: string }[]>`
      SELECT pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE conrelid = ${table}::regclass AND contype = 'c'
    `;
    expect(checks.some((check) => check.definition.includes(column))).toBe(true);
  });

  it("no pgEnum type exists in the public schema", async () => {
    const enums = await testSql<{ typname: string }[]>`
      SELECT typname FROM pg_type WHERE typtype = 'e'
    `;
    expect(enums).toHaveLength(0);
  });

  const instants = [
    ["user", "created_at"],
    ["user", "updated_at"],
    ["user", "deactivated_at"],
    ["credential", "created_at"],
    ["credential", "updated_at"],
    ["session", "created_at"],
    ["session", "last_seen_at"],
    ["session", "expires_at"],
    ["reset_token", "created_at"],
    ["reset_token", "expires_at"],
    ["reset_token", "used_at"],
    ["auth_attempt", "attempted_at"],
  ] as const;

  it.each(instants)("%s.%s is timestamptz", async (table, column) => {
    const columns = await columnsOf(table);
    expect(columnOf(columns, column).data_type).toBe("timestamp with time zone");
  });
});