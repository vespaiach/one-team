import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScreenHeader } from "@/features/shell/components/screen-header";
import { BoardSkeleton } from "./board-skeleton";

describe("BoardSkeleton (FR-007, §4 Loading)", () => {
  it("renders lane-shaped placeholders rather than one undifferentiated block", () => {
    const { container } = render(<BoardSkeleton />);

    expect(container.querySelectorAll('[data-region="lane"]').length).toBeGreaterThan(1);
  });

  it("gives every lane a header shape and card shapes, matching the lane layout it replaces", () => {
    const { container } = render(<BoardSkeleton />);

    for (const lane of container.querySelectorAll('[data-region="lane"]')) {
      expect(lane.querySelector('[data-shape="lane-header"]')).not.toBeNull();
      expect(lane.querySelectorAll('[data-shape="card"]').length).toBeGreaterThan(0);
    }
  });

  it("renders no full-screen spinner and no progressbar covering the page", () => {
    const { container } = render(<BoardSkeleton />);

    expect(container.querySelector('[role="progressbar"]')).toBeNull();
    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector("[data-spinner]")).toBeNull();
  });

  it("renders into the board frame the loaded board renders into, a horizontally scrolling strip", () => {
    const { container } = render(<BoardSkeleton />);

    const strip = container.querySelector('[data-region="board"]');
    expect(strip).not.toBeNull();
    expect(strip?.className).toContain("flex");
    expect(strip?.className).toContain("overflow-x-auto");
  });

  it("stands the loaded header's frame above the strip, so the lanes do not move when the data lands", () => {
    const loaded = render(<ScreenHeader name="Website Redesign" />).container.querySelector("header");
    const { container } = render(<BoardSkeleton />);

    const placeholder = container.querySelector("header");
    const strip = container.querySelector('[data-region="board"]');
    expect(placeholder).not.toBeNull();
    if (placeholder === null || strip === null) {
      throw new Error("the skeleton rendered no header placeholder above the strip");
    }

    expect(placeholder.className).toBe(loaded?.className);
    expect(placeholder.compareDocumentPosition(strip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("gives the header placeholder the name and context lines the loaded header carries", () => {
    const { container } = render(<BoardSkeleton />);

    expect(container.querySelector('header [data-shape="header-name"]')).not.toBeNull();
    expect(container.querySelector('header [data-shape="header-context"]')).not.toBeNull();
  });

  it("fixes each lane at the loaded lane's width so the layout does not shift when the data lands", () => {
    const { container } = render(<BoardSkeleton />);

    for (const lane of container.querySelectorAll('[data-region="lane"]')) {
      expect(lane.className).toContain("w-[288px]");
      expect(lane.className).toContain("shrink-0");
    }
  });
});