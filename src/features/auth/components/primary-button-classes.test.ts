import { describe, expect, it } from "vitest";
import { primaryButtonClasses } from "./primary-button-classes";

describe("primaryButtonClasses", () => {
  it("uses the resting accent fill by default", () => {
    const classes = primaryButtonClasses();

    expect(classes).toContain("bg-[var(--color-accent-fill)]");
    expect(classes).not.toMatch(/(?<!data-\[(?:hovered|pressed)\]:)bg-\[var\(--color-accent-hover\)\]/);
  });

  it("darkens to the hover step while pending, rather than dimming", () => {
    const classes = primaryButtonClasses({ pending: true });

    expect(classes).toContain("bg-[var(--color-accent-hover)]");
    expect(classes).not.toMatch(/(?<!data-\[disabled\]:)opacity/);
  });
});