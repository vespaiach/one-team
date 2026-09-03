import { describe, expect, it } from "vitest";
import { activity } from "./schema";

describe("activity table shape (FR-003, research A-5)", () => {
  it("carries no updatedAt column", () => {
    expect(activity).not.toHaveProperty("updatedAt");
  });
});