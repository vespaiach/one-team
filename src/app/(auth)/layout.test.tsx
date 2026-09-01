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
    expect(main.textContent).toContain("OneTeam");
    expect(screen.getByText("page content")).not.toBeNull();
  });

  it("renders the app mark as a two-block lockup per the visual identity (Visual Logo, turn 3)", () => {
    render(
      <AuthLayout>
        <p>page content</p>
      </AuthLayout>,
    );

    const one = screen.getByText("One");
    const team = screen.getByText("Team");

    expect(one.className).toContain("bg-[var(--color-text)]");
    expect(one.className).toContain("text-white");
    expect(team.className).toContain("bg-[var(--color-accent-fill)]");
    expect(team.className).toContain("text-[var(--color-on-accent)]");
    expect(one.parentElement?.className).toContain("uppercase");
    expect(one.parentElement?.className).toContain("font-black");
  });

  it("is a Server Component holding no state, and imports nothing from react-aria-components", () => {
    const source = readFileSync(join(process.cwd(), "src/app/(auth)/layout.tsx"), "utf8");

    expect(source).not.toContain('"use client"');
    expect(source).not.toContain("react-aria-components");
    expect(source).not.toMatch(/useState|useReducer/);
  });
});