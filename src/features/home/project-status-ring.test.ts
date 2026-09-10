import { describe, expect, it } from "vitest";
import { projectStatusRing } from "./project-status-ring";

describe("projectStatusRing", () => {
  it("is todo when a project has no completed issues", () => {
    expect(projectStatusRing({ done: 0, counted: 0 })).toBe("todo");
    expect(projectStatusRing({ done: 0, counted: 5 })).toBe("todo");
  });

  it("is progress once some but not all counted issues are done", () => {
    expect(projectStatusRing({ done: 2, counted: 5 })).toBe("progress");
  });

  it("is done once every counted issue is done", () => {
    expect(projectStatusRing({ done: 5, counted: 5 })).toBe("done");
  });
});