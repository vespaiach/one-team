import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Sidebar } from "./sidebar";

describe("Sidebar geometry (FR-005, FR-031)", () => {
  it("is a nav landmark carrying its own accessible name", () => {
    render(<Sidebar />);

    const nav = screen.getByRole("navigation");
    expect(nav.getAttribute("aria-label")).toBeTruthy();
  });

  it("is a fixed 262px column that never shrinks", () => {
    render(<Sidebar />);

    const nav = screen.getByRole("navigation");
    expect(nav.className).toContain("w-[262px]");
    expect(nav.className).toContain("shrink-0");
  });

  it("occupies the full height of the viewport and stays glued to the inline start under horizontal scroll", () => {
    render(<Sidebar />);

    const nav = screen.getByRole("navigation");
    expect(nav.className).toContain("self-stretch");
    expect(nav.className).toContain("sticky");
    expect(nav.className).toContain("start-0");
  });

  it("has the project-list region as the only internally scrolling part", () => {
    const { container } = render(<Sidebar />);

    const nav = screen.getByRole("navigation");
    const region = nav.querySelector("section");
    expect(region).not.toBeNull();
    expect(region?.className).toContain("overflow-y-auto");
    expect(container.querySelectorAll(".overflow-y-auto")).toHaveLength(1);
  });

  it("pins the chip's position to the sidebar's foot rather than letting it follow the entries above it in flow", () => {
    render(<Sidebar />);

    const nav = screen.getByRole("navigation");
    const chipSlot = nav.lastElementChild;
    expect(chipSlot?.className).toContain("mt-auto");
  });
});