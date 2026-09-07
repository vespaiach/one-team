import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../server/activity-queries", () => ({
  listInstallationActivity: vi.fn(),
}));

import type { InstallationActivityRow } from "../server/activity-queries";
import { listInstallationActivity } from "../server/activity-queries";
import { ActivitySection } from "./activity-section";

const SOURCE = readFileSync(
  join(process.cwd(), "src", "features", "home", "components", "activity-section.tsx"),
  "utf8",
);

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

function rows(count: number): InstallationActivityRow[] {
  return Array.from({ length: count }, (_, index) => row(index));
}

describe("ActivitySection is a labelled region (FR-001, FR-042)", () => {
  it("carries its own heading and names the region by it", async () => {
    vi.mocked(listInstallationActivity).mockResolvedValue(rows(20));

    render(await ActivitySection());

    expect(screen.getByRole("heading", { name: "Recent activity" })).not.toBeNull();
    expect(screen.getByRole("region", { name: "Recent activity" })).not.toBeNull();
  });
});

describe("ActivitySection renders what the query returned, up to twenty (FR-028, FR-031)", () => {
  it("renders one row each for twenty rows", async () => {
    vi.mocked(listInstallationActivity).mockResolvedValue(rows(20));

    render(await ActivitySection());

    expect(screen.getAllByRole("listitem")).toHaveLength(20);
    expect(screen.getAllByRole("link")).toHaveLength(20);
  });

  it("collapses nothing, so five rows from one actor stay five rows", async () => {
    vi.mocked(listInstallationActivity).mockResolvedValue(rows(5));

    render(await ActivitySection());

    expect(screen.getAllByRole("listitem")).toHaveLength(5);
  });
});

describe("ActivitySection renders one quiet line when empty (FR-040, SC-010, US4 s3)", () => {
  it("renders exactly one line and no list", async () => {
    vi.mocked(listInstallationActivity).mockResolvedValue([]);

    const { container } = render(await ActivitySection());

    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
    expect(container.querySelectorAll("p")).toHaveLength(1);
    expect(container.querySelector("p")?.textContent).toBe("Nothing has happened yet.");
  });
});

describe("ActivitySection offers no control of any kind (FR-032, FR-033, US4 s2)", () => {
  it("renders no button, no form and no input anywhere", async () => {
    vi.mocked(listInstallationActivity).mockResolvedValue(rows(20));

    const { container } = render(await ActivitySection());

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.queryByRole("switch")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
    expect(container.querySelectorAll("form")).toHaveLength(0);
    expect(container.querySelectorAll("input")).toHaveLength(0);
    expect(container.querySelectorAll("select")).toHaveLength(0);
  });

  it("renders no page control, load more, sort control or feed toggle text", async () => {
    vi.mocked(listInstallationActivity).mockResolvedValue(rows(20));

    const { container } = render(await ActivitySection());

    expect(container.textContent).not.toMatch(/load more/i);
    expect(container.textContent).not.toMatch(/older|newer|next page|previous/i);
    expect(container.textContent).not.toMatch(/comments only|all activity/i);
    expect(container.textContent).not.toMatch(/sort/i);
  });

  it("imports no pagination, collapsing or feed-filter module and is a Server Component", () => {
    expect(SOURCE).not.toMatch(/"use client"/);
    expect(SOURCE).not.toMatch(/feed-pagination|feed-filter-toggle|feed-filter/);
    expect(SOURCE).not.toMatch(/collapse/);
    expect(SOURCE).not.toMatch(/listFeed/);
    expect(SOURCE).not.toMatch(/onScroll|IntersectionObserver/);
  });
});