import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ShownValue } from "./shown-value";

describe("ShownValue (FR-024, FR-035, OT-UX-010)", () => {
  it("renders a visible label programmatically associated with its value", () => {
    render(
      <ShownValue
        label="Email"
        value="ada@example.com"
      />,
    );

    expect(screen.getByText("Email")).not.toBeNull();
    const group = screen.getByRole("group", { name: "Email" });
    expect(group.textContent).toContain("ada@example.com");
  });

  it("is not a button", () => {
    render(
      <ShownValue
        label="Account role"
        value="admin"
      />,
    );

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("is not in the tab order", () => {
    render(
      <ShownValue
        label="Account role"
        value="admin"
      />,
    );

    const group = screen.getByRole("group", { name: "Account role" });
    expect(group.tabIndex).toBe(-1);
  });
});