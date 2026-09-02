import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Forbidden from "./forbidden";

describe("(app)/forbidden.tsx (FR-019, FR-007, s9)", () => {
  it("renders a header named for Forbidden itself, with both slots empty, above the notice", () => {
    render(<Forbidden />);

    expect(screen.getByRole("heading", { level: 1, name: "Forbidden" })).not.toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("link", { name: /new issue/i })).toBeNull();
    expect(screen.getByText("403")).not.toBeNull();
    expect(screen.getByText("You don't have access to this.")).not.toBeNull();
  });
});