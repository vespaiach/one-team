import { describe, expect, it } from "vitest";
import { dialogPanelClassName, dialogPanelCompactClassName } from "./dialog-panel";

describe("dialog-panel — the shared dialog-shell class (research.md D-3, D-6)", () => {
  it("produces the 5px-multiple-corrected gap for the default variant", () => {
    expect(dialogPanelClassName).toBe(
      "flex w-full max-w-[420px] flex-col gap-[15px] bg-(--color-bg) p-4 shadow-lg",
    );
  });

  it("keeps the compact variant's already-5px-multiple gap unchanged", () => {
    expect(dialogPanelCompactClassName).toBe(
      "flex w-full max-w-[420px] flex-col gap-[10px] bg-(--color-bg) p-4 shadow-lg",
    );
  });
});