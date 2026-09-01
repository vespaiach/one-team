import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ForbiddenNotice } from "./forbidden-notice";

describe("ForbiddenNotice (FR-019, SC-006, §3.11)", () => {
  it("renders the code, the exact sentence, and a link back to Home (s1)", () => {
    render(<ForbiddenNotice />);

    expect(screen.getByText("403")).not.toBeNull();
    expect(screen.getByText("You don't have access to this.")).not.toBeNull();

    const homeLink = screen.getByRole("link", { name: "Home" });
    expect(homeLink.getAttribute("href")).toBe("/home");
  });

  it("is a real focusable control, never a full-screen takeover", () => {
    render(<ForbiddenNotice />);

    const homeLink = screen.getByRole("link", { name: "Home" });
    homeLink.focus();
    expect(document.activeElement).toBe(homeLink);
  });
});