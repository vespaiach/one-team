import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusMessage } from "./StatusMessage.tsx";

describe("StatusMessage", () => {
  it("renders the text as a focusable level-2 heading inside a status region", () => {
    render(<StatusMessage>Check your email</StatusMessage>);
    const region = screen.getByRole("status");
    const heading = within(region).getByRole("heading", {
      level: 2,
      name: "Check your email",
    });
    expect(heading.getAttribute("tabindex")).toBe("-1");
  });

  it("takes focus after mount with focusOnShow", () => {
    render(<StatusMessage focusOnShow>This link has expired</StatusMessage>);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "This link has expired" }));
  });

  it("leaves focus on the body without focusOnShow", () => {
    render(<StatusMessage>Check your email</StatusMessage>);
    expect(document.activeElement).toBe(document.body);
  });

  it("shows a 60-character full name whole", () => {
    const fullName = `${"A".repeat(30)} ${"B".repeat(29)}`;
    expect(fullName).toHaveLength(60);
    const text = `You're signed in as ${fullName}. Sign out to use this sign-in link.`;
    render(<StatusMessage>{text}</StatusMessage>);
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(text);
  });
});