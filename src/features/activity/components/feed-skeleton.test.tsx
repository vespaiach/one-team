import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FeedSkeleton } from "./feed-skeleton";

describe("FeedSkeleton (FR-060)", () => {
  it("matches the feed's own layout — a composer shape above a run of row shapes", () => {
    const { container } = render(<FeedSkeleton />);

    expect(container.querySelector('[data-region="composer"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-region="row"]').length).toBeGreaterThan(0);
  });

  it("renders no full-screen spinner", () => {
    const { container } = render(<FeedSkeleton />);

    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector("[data-spinner]")).toBeNull();
  });
});