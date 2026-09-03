import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LabelsScreen } from "./labels-screen";
import { LabelsSkeleton } from "./labels-skeleton";

describe("LabelsSkeleton (SC-001, OT-UX-005)", () => {
  it("renders the same table headers as LabelsScreen's table, so nothing shifts when data lands", () => {
    const { container: skeletonContainer } = render(<LabelsSkeleton />);
    const { container: screenContainer } = render(
      <LabelsScreen
        labels={[{ id: "l1", name: "Bug", issueCount: 1 }]}
        createLabelAction={vi.fn()}
        updateLabelAction={vi.fn()}
        checkNameAvailable={vi.fn().mockResolvedValue({ holder: null })}
        deleteLabelAction={vi.fn()}
      />,
    );

    const skeletonHeaders = skeletonContainer.querySelectorAll("th");
    const screenHeaders = screenContainer.querySelectorAll("th");
    expect(skeletonHeaders).toHaveLength(screenHeaders.length);
    expect(Array.from(skeletonHeaders).map((th) => th.textContent)).toEqual(
      Array.from(screenHeaders).map((th) => th.textContent),
    );
  });

  it("renders more than one placeholder row", () => {
    const { container } = render(<LabelsSkeleton />);

    expect(container.querySelectorAll("tbody tr").length).toBeGreaterThan(1);
  });

  it("marks itself as a busy region for assistive technology, never a full-screen spinner", () => {
    const { container } = render(<LabelsSkeleton />);

    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });
});