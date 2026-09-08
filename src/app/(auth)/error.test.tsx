import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AuthError from "./error";

describe("AuthError", () => {
  it("renders a recoverable notice as a banner, with a route back to /reset", () => {
    render(
      <AuthError
        error={new Error("boom")}
        retry={vi.fn()}
      />,
    );

    const banner = screen.getByRole("alert");
    expect(banner.textContent).toContain("Try the link again, or request a new one below.");
    const link = screen.getByRole("link", { name: /request a new link/i });
    expect(link.getAttribute("href")).toBe("/reset");
  });

  it("also links back to sign in", () => {
    render(
      <AuthError
        error={new Error("boom")}
        retry={vi.fn()}
      />,
    );

    const link = screen.getByRole("link", { name: /back to sign in/i });
    expect(link.getAttribute("href")).toBe("/signin");
  });

  it("logs the caught error for diagnosis", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = new Error("boom");

    render(
      <AuthError
        error={error}
        retry={vi.fn()}
      />,
    );

    expect(consoleError).toHaveBeenCalledWith(error);
    consoleError.mockRestore();
  });
});