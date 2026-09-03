import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CreateIssueFormSkeleton, IssueDetailSkeleton } from "./issue-skeletons";

function fieldCount(container: HTMLElement): number {
  return container.querySelectorAll("[data-field]").length;
}

describe("CreateIssueFormSkeleton (FR-067, OT-UX-005)", () => {
  it("renders one shape per field on the create-issue form", () => {
    const { container } = render(<CreateIssueFormSkeleton />);

    expect(fieldCount(container)).toBe(6);
  });

  it("reserves a taller shape for the description field, matching its growing layout", () => {
    const { container } = render(<CreateIssueFormSkeleton />);

    const descriptionField = container.querySelector('[data-field="description"]');
    expect(descriptionField).not.toBeNull();
    expect(descriptionField?.className).toContain("min-h-");
  });

  it("renders no full-screen spinner", () => {
    const { container } = render(<CreateIssueFormSkeleton />);

    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector("[data-spinner]")).toBeNull();
  });
});

describe("IssueDetailSkeleton (FR-067, SC-021, OT-UX-005)", () => {
  it("renders a main column shape and a 262px rail shape", () => {
    const { container } = render(<IssueDetailSkeleton />);

    const rail = container.querySelector('[data-region="rail"]');
    expect(container.querySelector('[data-region="main"]')).not.toBeNull();
    expect(rail).not.toBeNull();
    expect(rail?.className).toContain("262px");
  });

  it("renders no full-screen spinner", () => {
    const { container } = render(<IssueDetailSkeleton />);

    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector("[data-spinner]")).toBeNull();
  });
});