import { describe, expect, it } from "vitest";
import { testSql } from "./test-database";

async function indexDefsFor(table: string): Promise<string[]> {
  const rows = await testSql<{ indexdef: string }[]>`
    SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename = ${table}
  `;
  return rows.map((row) => row.indexdef);
}

describe("migration (FR-008, research C-9)", () => {
  it("drops the inherited setup_check placeholder", async () => {
    const rows = await testSql<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'setup_check'
      ) AS exists
    `;
    expect(rows[0]?.exists).toBe(false);
  });

  it("indexes lower(email) uniquely on user", async () => {
    const defs = await indexDefsFor("user");
    expect(defs.some((def) => /unique/i.test(def) && /lower\(email\)/i.test(def))).toBe(true);
  });

  it("indexes token_digest uniquely, user_id and expires_at on session", async () => {
    const defs = await indexDefsFor("session");
    expect(defs.some((def) => /unique/i.test(def) && /token_digest/i.test(def))).toBe(true);
    expect(defs.some((def) => /\(user_id\)/i.test(def))).toBe(true);
    expect(defs.some((def) => /\(expires_at\)/i.test(def))).toBe(true);
  });

  it("indexes token_digest uniquely and user_id on reset_token", async () => {
    const defs = await indexDefsFor("reset_token");
    expect(defs.some((def) => /unique/i.test(def) && /token_digest/i.test(def))).toBe(true);
    expect(defs.some((def) => /\(user_id\)/i.test(def))).toBe(true);
  });

  it("indexes (flow, kind, subject, attempted_at) and (attempted_at) on auth_attempt", async () => {
    const defs = await indexDefsFor("auth_attempt");
    expect(defs.some((def) => /\(flow, kind, subject, attempted_at\)/i.test(def))).toBe(true);
    expect(defs.some((def) => /\(attempted_at\)/i.test(def))).toBe(true);
  });
});