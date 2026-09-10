import { describe, expect, it } from "vitest";
import { progressBarWidths } from "./progress-bar-widths";

describe("progressBarWidths", () => {
  it("splits done and remaining open issues into percentages that sum to 100", () => {
    expect(progressBarWidths({ done: 3, counted: 5 })).toEqual({ donePercent: 60, todoPercent: 40 });
  });

  it("is all zero when nothing is counted yet", () => {
    expect(progressBarWidths({ done: 0, counted: 0 })).toEqual({ donePercent: 0, todoPercent: 0 });
  });

  it("is entirely done once everything counted is done", () => {
    expect(progressBarWidths({ done: 4, counted: 4 })).toEqual({ donePercent: 100, todoPercent: 0 });
  });
});