import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PROFILE_FIELDS } from "./fields";

describe("PROFILE_FIELDS (FR-006, FR-020)", () => {
  it("lists exactly the seven writable fields, in screen order", () => {
    expect(PROFILE_FIELDS.map((definition) => definition.field)).toEqual([
      "avatarUrl",
      "firstName",
      "lastName",
      "jobTitle",
      "slackHandle",
      "phone",
      "bio",
    ]);
  });

  it("carries a non-empty label for every field", () => {
    for (const definition of PROFILE_FIELDS) {
      expect(definition.label.length).toBeGreaterThan(0);
    }
  });

  it("carries the bound each field's column enforces, in code points", () => {
    const bounds = Object.fromEntries(
      PROFILE_FIELDS.map((definition) => [definition.field, definition.bound]),
    );
    expect(bounds).toEqual({
      avatarUrl: 2000,
      firstName: 200,
      lastName: 200,
      jobTitle: 200,
      slackHandle: 200,
      phone: 200,
      bio: 10000,
    });
  });

  it("imports nothing server-only, so a Client Component can read it", () => {
    const source = readFileSync(new URL("./fields.ts", import.meta.url), "utf8");
    expect(source).not.toContain("server-only");
  });
});