import { describe, expect, it } from "vitest";
import { accountUser, publicUser } from "./projections";

describe("projections (FR-004, OT-DATA-005)", () => {
  it("publicUser carries exactly its seven columns", () => {
    expect(Object.keys(publicUser).sort()).toEqual(
      ["id", "firstName", "lastName", "avatarUrl", "role", "jobTitle", "deactivatedAt"].sort(),
    );
  });

  it("accountUser adds exactly the four contact fields", () => {
    expect(Object.keys(accountUser).sort()).toEqual(
      [
        "id",
        "firstName",
        "lastName",
        "avatarUrl",
        "role",
        "jobTitle",
        "deactivatedAt",
        "email",
        "slackHandle",
        "phone",
        "bio",
      ].sort(),
    );
  });

  it("neither projection selects a password", () => {
    expect(Object.keys(publicUser)).not.toContain("passwordHash");
    expect(Object.keys(accountUser)).not.toContain("passwordHash");
  });
});