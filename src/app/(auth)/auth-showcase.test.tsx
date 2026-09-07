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
});