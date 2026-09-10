import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { listAssignedIssues } = vi.hoisted(() => ({ listAssignedIssues: vi.fn() }));
const { countOpenIssuesForTeam } = vi.hoisted(() => ({ countOpenIssuesForTeam: vi.fn() }));
vi.mock("../server/assigned-queries", () => ({ listAssignedIssues }));
vi.mock("../server/metrics-queries", () => ({ countOpenIssuesForTeam }));

const { MetricStripSection } = await import("./metric-strip-section");

describe("MetricStripSection", () => {
  it("derives the due-this-week count from the assigned issues", async () => {
    listAssignedIssues.mockResolvedValue([
      { id: "1", dueThisWeek: true },
      { id: "2", dueThisWeek: false },
      { id: "3", dueThisWeek: true },
    ]);
    countOpenIssuesForTeam.mockResolvedValue(23);

    render(await MetricStripSection({ userId: "user-1" }));

    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
    expect(screen.getByText("23")).toBeTruthy();
  });
});