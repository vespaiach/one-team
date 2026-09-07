import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../server/activity-queries", () => ({
  listInstallationActivity: vi.fn(),
}));

import type { InstallationActivityRow } from "../server/activity-queries";
import { listInstallationActivity } from "../server/activity-queries";
import { ActivitySection } from "./activity-section";
import { ActivitySkeleton } from "./activity-skeleton";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

afterEach(() => {
  vi.clearAllMocks();
});

function row(index: number): InstallationActivityRow {
  return {
    id: `a${index}`,
    kind: "created",
    actor: {
      id: "u1",
      firstName: "Alan",
      lastName: "Turing",
      avatarUrl: null,
      role: "member",
      jobTitle: null,
      deactivatedAt: null,
    },
    targetLabel: `WEB-${index} · Fix the header`,
    projectName: "Website Redesign",
    href: `/projects/WEB/issues/${index}/details`,
    createdAt: new Date(Date.now() - TWO_HOURS_MS),
    field: null,
    fromValue: null,
    toValue: null,
  };
}

function boxGeometry(element: Element): string[] {
  return element.className
    .split(" ")
    .filter((token) => /^(px-|py-|gap-|text-(control|label)$)/.test(token))
    .sort();
}

describe("ActivitySkeleton (FR-038, SC-011, screens §2)", () => {
  it("reserves exactly the twenty placeholder rows §3.2 bounds Recent activity at", () => {
    const { container } = render(<ActivitySkeleton />);

    expect(container.querySelectorAll("li")).toHaveLength(20);
  });

  it("marks itself busy for assistive technology and is never a spinner", () => {
    const { container } = render(<ActivitySkeleton />);

    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("renders pulse blocks in the repo's established form", () => {
    const { container } = render(<ActivitySkeleton />);

    const blocks = container.querySelectorAll(".animate-pulse");
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block.className).toContain("bg-(--color-divider)");
    }
  });

  it("matches the loaded section's frame, heading and per-row geometry for a twenty-row load", async () => {
    const { container: skeleton } = render(<ActivitySkeleton />);

    vi.mocked(listInstallationActivity).mockResolvedValue(
      Array.from({ length: 20 }, (_, index) => row(index)),
    );
    const { container: loaded } = render(await ActivitySection());

    expect(skeleton.querySelectorAll("ul")).toHaveLength(loaded.querySelectorAll("ul").length);
    expect(skeleton.querySelectorAll("li")).toHaveLength(loaded.querySelectorAll("li").length);

    const skeletonHeading = skeleton.querySelector("h2");
    const loadedHeading = loaded.querySelector("h2");
    expect(skeletonHeading?.textContent).toBe(loadedHeading?.textContent);
    expect(skeletonHeading === null ? null : boxGeometry(skeletonHeading)).toEqual(
      loadedHeading === null ? null : boxGeometry(loadedHeading),
    );

    const skeletonRow = skeleton.querySelector("li")?.firstElementChild ?? null;
    const loadedRow = loaded.querySelector("li")?.firstElementChild ?? null;
    expect(skeletonRow === null ? null : boxGeometry(skeletonRow)).toEqual(
      loadedRow === null ? null : boxGeometry(loadedRow),
    );
  });
});