import { describe, expect, it } from "vitest";
import { testSql } from "./test-database";
import { touched } from "./touched";

describe("touched() (FR-003, OT-DATA-002)", () => {
  it("stamps updated_at onto the given values", () => {
    const before = Date.now();
    const result = touched({ firstName: "Ada" });
    const after = Date.now();

    expect(result.firstName).toBe("Ada");
    expect(result.updatedAt).toBeInstanceOf(Date);
    expect(result.updatedAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.updatedAt.getTime()).toBeLessThanOrEqual(after);
  });

  it("no database trigger writes updated_at on user or credential", async () => {
    const rows = await testSql<{ count: string }[]>`
      SELECT count(*)::text AS count
      FROM pg_trigger
      WHERE tgrelid IN ('"user"'::regclass, '"credential"'::regclass) AND NOT tgisinternal
    `;
    expect(rows[0]?.count).toBe("0");
  });
});