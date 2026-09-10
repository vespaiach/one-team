import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MetricStrip } from "./metric-strip";

describe("MetricStrip", () => {
  it("shows the assigned, due-this-week and team-open counts", () => {
    render(
      <MetricStrip
        assignedCount={4}
        dueThisWeekCount={1}
        teamOpenCount={23}
      />,
    );

    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("Assigned to you")).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.getByText("Due this week")).toBeTruthy();
    expect(screen.getByText("23")).toBeTruthy();
    expect(screen.getByText("Open · whole team")).toBeTruthy();
  });
});