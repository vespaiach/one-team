import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../server/project-queries", () => ({
  listMemberProjectsWithProgress: vi.fn(),
}));

import type { ProjectProgressRow } from "../server/project-queries";
import { listMemberProjectsWithProgress } from "../server/project-queries";
import { ProjectsSection } from "./projects-section";
import { ProjectsSkeleton } from "./projects-skeleton";

afterEach(() => {
  vi.clearAllMocks();
});

function row(index: number): ProjectProgressRow {
  return {
    key: `P${index}`,
    name: `Project ${index}`,
    status: "active",
    href: `/projects/P${index}`,
    done: index,
    counted: 10,
    targetDate: null,
  };
}

function boxGeometry(element: Element): string[] {
  return element.className
    .split(" ")
    .filter((token) => /^(px-|py-|gap-|text-(control|label)$)/.test(token))
    .sort();
}

describe("ProjectsSkeleton (FR-038, SC-011)", () => {
  it("reserves exactly the three placeholder rows FR-038 gives this unbounded section", () => {
    const { container } = render(<ProjectsSkeleton />);

    expect(container.querySelectorAll("li")).toHaveLength(3);
  });

  it("marks itself busy for assistive technology and is never a spinner", () => {
    const { container } = render(<ProjectsSkeleton />);

    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("renders pulse blocks in the repo's established form", () => {
    const { container } = render(<ProjectsSkeleton />);

    const blocks = container.querySelectorAll(".animate-pulse");
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block.className).toContain("bg-(--color-divider)");
    }
  });

  it("matches the loaded section's frame, heading and per-row geometry for a three-row load", async () => {
    const { container: skeleton } = render(<ProjectsSkeleton />);

    vi.mocked(listMemberProjectsWithProgress).mockResolvedValue([row(1), row(2), row(3)]);
    const { container: loaded } = render(await ProjectsSection({ userId: "u1" }));

    expect(skeleton.querySelectorAll("ul")).toHaveLength(loaded.querySelectorAll("ul").length);
    expect(skeleton.querySelectorAll("li")).toHaveLength(loaded.querySelectorAll("li").length);

    const skeletonHeading = skeleton.querySelector("h2");
    const loadedHeading = loaded.querySelector("h2");
    expect(skeletonHeading?.textContent).toBe(loadedHeading?.textContent);
    expect(skeletonHeading === null ? null : boxGeometry(skeletonHeading)).toEqual(
      loadedHeading === null ? null : boxGeometry(loadedHeading),
    );

    const skeletonRow = skeleton.querySelectorAll("li")[0]?.firstElementChild ?? null;
    const loadedRow = loaded.querySelectorAll("li")[0]?.firstElementChild ?? null;
    expect(skeletonRow === null ? null : boxGeometry(skeletonRow)).toEqual(
      loadedRow === null ? null : boxGeometry(loadedRow),
    );
  });
});