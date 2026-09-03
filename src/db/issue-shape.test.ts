import { describe, expect, it } from "vitest";
import { issue } from "./schema";

describe("issue table shape (FR-002, FR-003, FR-057, research E-4)", () => {
  it("carries no status column", () => {
    expect(issue).not.toHaveProperty("status");
  });

  it("carries no parentId or any self-reference column", () => {
    expect(issue).not.toHaveProperty("parentId");
    expect(issue).not.toHaveProperty("parentIssueId");
  });

  it("carries no deletedAt column", () => {
    expect(issue).not.toHaveProperty("deletedAt");
  });
});