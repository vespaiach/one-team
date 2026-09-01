import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AuthLayout from "./layout";

describe("(auth) layout (research A-1, A-2, OT-UX-001)", () => {
  it("renders a <main> landmark carrying the page background, the app mark and the card", () => {
    render(
      <AuthLayout>
        <p>page content</p>
      </AuthLayout>,
    );

    const main = screen.getByRole("main");
    expect(main.className).toContain("--color-bg");
    expect(main.textContent).toContain("One Team");
    expect(screen.getByText("page content")).not.toBeNull();
  });

  it("renders the app mark as a single logo lockup, centred on the page", () => {
    render(
      <AuthLayout>
        <p>page content</p>
      </AuthLayout>,
    );

    const main = screen.getByRole("main");
    expect(main.className).toContain("items-center");
    expect(main.className).toContain("justify-center");

    const mark = screen.getByText("One Team");
    expect(mark.tagName).toBe("SPAN");
    expect(mark.className).toContain("font-heading");

    const svg = mark.parentElement?.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders the card with a 2px divider border, no radius and the page's own background", () => {
    render(
      <AuthLayout>
        <p>page content</p>
      </AuthLayout>,
    );

    const card = screen.getByText("page content").closest("div");
    expect(card?.className).toContain("border-2");
    expect(card?.className).toContain("border-[var(--color-divider)]");
    expect(card?.className).toContain("bg-[var(--color-bg)]");
  });

  it("is a Server Component holding no state, and imports nothing from react-aria-components", () => {
    const source = readFileSync(join(process.cwd(), "src/app/(auth)/layout.tsx"), "utf8");

    expect(source).not.toContain('"use client"');
    expect(source).not.toContain("react-aria-components");
    expect(source).not.toMatch(/useState|useReducer/);
  });
});