import { describe, expect, it } from "vitest";
import { formatIssueKey } from "./issue-key";

describe("formatIssueKey (FR-012, SC-004, data-model §6)", () => {
  it("joins the project key and the number as WEB-142", () => {
    expect(formatIssueKey("WEB", 142)).toBe("WEB-142");
  });

  it("does not pad, round, or otherwise transform the number", () => {
    expect(formatIssueKey("WEB", 1)).toBe("WEB-1");
    expect(formatIssueKey("WEB", 1000)).toBe("WEB-1000");
  });

  it("yields the same key for the same project key and number on every call", () => {
    const first = formatIssueKey("WEB", 142);
    const second = formatIssueKey("WEB", 142);

    expect(first).toBe(second);
    expect(first).toBe("WEB-142");
  });

  it("keys two issues in different projects distinctly even when their numbers match", () => {
    expect(formatIssueKey("WEB", 1)).not.toBe(formatIssueKey("API", 1));
  });
});