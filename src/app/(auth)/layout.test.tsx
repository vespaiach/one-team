import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AuthLayout from "./layout";

describe("(auth) layout", () => {
  it("renders a <main> landmark scoped to the Broadsheet palette", () => {
    render(
      <AuthLayout>
        <p>page content</p>
      </AuthLayout>,
    );

    const main = screen.getByRole("main");
    expect(main.style.getPropertyValue("--color-bg")).toBe("#f8f2ed");
    expect(main.className).toContain("bg-[var(--color-bg)]");
    expect(screen.getByText("page content")).not.toBeNull();
  });

  it("renders no bordered card around the page content", () => {
    render(
      <AuthLayout>
        <p>page content</p>
      </AuthLayout>,
    );

    const content = screen.getByText("page content");
    expect(content.closest(".border-2")).toBeNull();
  });

  it("renders the One Team mark exactly once, in the form pane", () => {
    render(
      <AuthLayout>
        <p>page content</p>
      </AuthLayout>,
    );

    expect(screen.getAllByText("One Team")).toHaveLength(1);
  });

  it("renders a decorative illustration pane hidden from assistive tech", () => {
    const { container } = render(
      <AuthLayout>
        <p>page content</p>
      </AuthLayout>,
    );

    const hiddenNodes = [...container.querySelectorAll('[aria-hidden="true"]')];
    expect(hiddenNodes.some((node) => node.textContent?.includes("One team, one workspace."))).toBe(true);
  });

  it("is a Server Component holding no state, and imports nothing from react-aria-components", () => {
    const source = readFileSync(join(process.cwd(), "src/app/(auth)/layout.tsx"), "utf8");

    expect(source).not.toContain('"use client"');
    expect(source).not.toContain("react-aria-components");
    expect(source).not.toMatch(/useState|useReducer/);
  });
});