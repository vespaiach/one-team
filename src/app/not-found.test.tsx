import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import NotFound from "./not-found";

describe("src/app/not-found.tsx (SC-008, FR-022)", () => {
  it("renders the shared NotFoundNotice under the root layout only, with no header", () => {
    render(<NotFound />);

    expect(screen.getByText("This doesn't exist")).not.toBeNull();
    expect(screen.queryByRole("heading")).toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
  });
});