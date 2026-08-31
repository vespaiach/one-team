import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MustChangePasswordBanner } from "./must-change-password-banner";

describe("MustChangePasswordBanner (FR-049, research D-4)", () => {
  it("states the condition and offers no dismiss control", () => {
    render(<MustChangePasswordBanner />);

    expect(
      screen.getByText("Your password is still the one set when this server was installed."),
    ).not.toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("is not an error or a modal", () => {
    render(<MustChangePasswordBanner />);

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});