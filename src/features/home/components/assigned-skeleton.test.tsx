import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../server/assigned-queries", () => ({
  listAssignedIssues: vi.fn(),
}));

import type { AssignedIssueRow } from "../server/assigned-queries";
import { listAssignedIssues } from "../server/assigned-queries";
import { AssignedSection } from "./assigned-section";
import { AssignedSkeleton } from "./assigned-skeleton";

afterEach(() => {
  vi.clearAllMocks();
});

const ROW_GEOMETRY_CLASSES = ["flex", "items-baseline", "gap-2", "px-4.5", "py-2", "text-control"];

function assignedRow(index: number): AssignedIssueRow {
  return {
    id: `i${index}`,
    key: `WEB-${index}`,
    title: `Issue ${index}`,
    projectName: "Website Redesign",
    href: `/projects/WEB/issues/${index}/details`,
    dueThisWeek: false,
  };
}

describe("AssignedSkeleton (FR-038, SC-011)", () => {
  it("marks itself busy for assistive technology and renders no spinner", () => {
    const { container } = render(<AssignedSkeleton />);

    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("reserves the three rows FR-038 fixes for this unbounded section", () => {
    const { container } = render(<AssignedSkeleton />);

    expect(container.querySelectorAll("li")).toHaveLength(3);
    const blocks = container.querySelectorAll(".animate-pulse");
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block.className).toContain("bg-(--color-divider)");
    }
  });

  it("matches the loaded section's list frame, heading and per-row geometry, so a three-row load shifts nothing", async () => {
    vi.mocked(listAssignedIssues).mockResolvedValue([assignedRow(1), assignedRow(2), assignedRow(3)]);

    const { container: skeleton } = render(<AssignedSkeleton />);
    const { container: loaded } = render(await AssignedSection({ userId: "u1" }));

    expect(skeleton.querySelector("section")?.className).toBe(loaded.querySelector("section")?.className);
    expect(skeleton.querySelector("h2")?.textContent).toBe(loaded.querySelector("h2")?.textContent);
    expect(skeleton.querySelector("h2")?.className).toBe(loaded.querySelector("h2")?.className);
    expect(skeleton.querySelector("ul")?.className).toBe(loaded.querySelector("ul")?.className);
    expect(skeleton.querySelectorAll("li")).toHaveLength(loaded.querySelectorAll("li").length);

    const skeletonRow = skeleton.querySelector("li")?.firstElementChild;
    const loadedRow = loaded.querySelector("li")?.firstElementChild;
    for (const geometryClass of ROW_GEOMETRY_CLASSES) {
      expect(skeletonRow?.className.split(" ")).toContain(geometryClass);
      expect(loadedRow?.className.split(" ")).toContain(geometryClass);
    }
  });
});