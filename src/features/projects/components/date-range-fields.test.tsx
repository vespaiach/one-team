import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DateRangeFields } from "./date-range-fields";

describe("DateRangeFields (FR-028)", () => {
  it("renders both fields, each optional, with no error when neither is set", () => {
    render(
      <DateRangeFields
        startDate={null}
        targetDate={null}
        onStartDateChange={vi.fn()}
        onTargetDateChange={vi.fn()}
      />,
    );

    expect(screen.getByText("Start date")).toBeDefined();
    expect(screen.getByText("Target date")).toBeDefined();
    expect(screen.queryByText(/before the start date/i)).toBeNull();
  });

  it("leaves the target independent when only the start date is set", () => {
    render(
      <DateRangeFields
        startDate="2026-06-10"
        targetDate={null}
        onStartDateChange={vi.fn()}
        onTargetDateChange={vi.fn()}
      />,
    );

    expect(screen.queryByText(/before the start date/i)).toBeNull();
  });

  it("leaves the start independent when only the target date is set", () => {
    render(
      <DateRangeFields
        startDate={null}
        targetDate="2026-06-01"
        onStartDateChange={vi.fn()}
        onTargetDateChange={vi.fn()}
      />,
    );

    expect(screen.queryByText(/before the start date/i)).toBeNull();
  });

  it("treats a target equal to the start as legal", () => {
    render(
      <DateRangeFields
        startDate="2026-06-10"
        targetDate="2026-06-10"
        onStartDateChange={vi.fn()}
        onTargetDateChange={vi.fn()}
      />,
    );

    expect(screen.queryByText(/before the start date/i)).toBeNull();
  });

  it("renders an inline error on the target field when it precedes the start", () => {
    render(
      <DateRangeFields
        startDate="2026-06-10"
        targetDate="2026-06-01"
        onStartDateChange={vi.fn()}
        onTargetDateChange={vi.fn()}
      />,
    );

    expect(screen.getByText(/before the start date/i)).toBeDefined();
  });
});