import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DatePickerPopoverField } from "./date-picker-popover-field";

describe("DatePickerPopoverField", () => {
  it("shows the field label on the collapsed trigger when no date is set", () => {
    render(
      <DatePickerPopoverField
        label="Target date"
        value={null}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Target date/ })).toBeTruthy();
  });

  it("shows the formatted date on the collapsed trigger once a value is set", () => {
    render(
      <DatePickerPopoverField
        label="Target date"
        value="2026-03-05"
        onChange={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: /Mar 5, 2026/ });
    expect(trigger).toBeTruthy();
  });

  it("reveals the date input segments when the trigger is activated", () => {
    render(
      <DatePickerPopoverField
        label="Target date"
        value={null}
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("group", { name: "Target date" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /Target date/ }));

    expect(screen.getByRole("group", { name: "Target date" })).toBeTruthy();
  });
});