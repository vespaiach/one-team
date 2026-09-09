import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthShowcase } from "./auth-showcase";

describe("AuthShowcase", () => {
  it("is entirely hidden from assistive tech, being decorative", () => {
    const { container } = render(<AuthShowcase />);

    expect(container.firstElementChild?.getAttribute("aria-hidden")).toBe("true");
  });

  it("renders the workspace tagline", () => {
    const { getByText } = render(<AuthShowcase />);

    expect(getByText("One team, one workspace.")).not.toBeNull();
  });

  it("is a Server Component holding no state", () => {
    const source = readFileSync(join(process.cwd(), "src/app/(auth)/auth-showcase.tsx"), "utf8");

    expect(source).not.toContain('"use client"');
    expect(source).not.toMatch(/useState|useReducer/);
  });

  it("derives the grid-line backgroundImage colours from --color-text via color-mix", () => {
    const source = readFileSync(join(process.cwd(), "src/app/(auth)/auth-showcase.tsx"), "utf8");

    expect(source).not.toContain("rgba(43,28,21,0.05)");
    expect(source).not.toContain("rgba(43,28,21,0.09)");
    expect(source).toContain("color-mix(in srgb, var(--color-text) 5%, transparent)");
    expect(source).toContain("color-mix(in srgb, var(--color-text) 9%, transparent)");
  });
});