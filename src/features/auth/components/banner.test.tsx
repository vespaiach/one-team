import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Banner } from "./banner";
import { XCircleIcon } from "./icons";

describe("Banner", () => {
  it("renders as an alert region carrying its icon and message", () => {
    render(<Banner icon={XCircleIcon}>That email and password don&rsquo;t match.</Banner>);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("That email and password don’t match.");
    expect(alert.querySelector("svg")).not.toBeNull();
  });

  it("carries the accent-tinted banner classes", () => {
    render(<Banner icon={XCircleIcon}>Message</Banner>);

    const alert = screen.getByRole("alert");
    expect(alert.className).toContain("border-l-[3px]");
    expect(alert.className).toContain("bg-[var(--color-accent-100)]");
  });
});