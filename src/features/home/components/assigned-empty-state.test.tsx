import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AssignedEmptyState } from "./assigned-empty-state";

describe("AssignedEmptyState", () => {
  it("explains the empty queue and offers both escape hatches", () => {
    render(
      <AssignedEmptyState
        totalOpenCount={17}
        projects={[{ key: "APOLLO", name: "Apollo Platform", status: "active" }]}
      />,
    );

    expect(screen.getByText("Your queue is clear")).toBeTruthy();
    expect(screen.getByRole("link", { name: "All 17 open issues →" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /New issue/ })).toBeTruthy();
  });
});