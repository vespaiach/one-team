import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LabelOption } from "../server/queries";
import { LabelPickerField } from "./label-picker-field";

const OPTIONS: LabelOption[] = [
  { id: "label-1", name: "Bug", applied: true },
  { id: "label-2", name: "Feature", applied: false },
];

describe("LabelPickerField — options and applied state (FR-015, FR-016, FR-017)", () => {
  it("renders every team label with its applied state as a checked selection", () => {
    render(
      <LabelPickerField
        options={OPTIONS}
        onToggle={vi.fn()}
        canManageLabels={false}
      />,
    );

    expect(screen.getByRole("option", { name: "Bug" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("option", { name: "Feature" }).getAttribute("aria-selected")).toBe("false");
  });

  it("reports a toggle to the caller, applying an unapplied option", () => {
    const onToggle = vi.fn();
    render(
      <LabelPickerField
        options={OPTIONS}
        onToggle={onToggle}
        canManageLabels={false}
      />,
    );

    fireEvent.click(screen.getByRole("option", { name: "Feature" }));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith("label-2", true);
  });

  it("reports a toggle to the caller, removing an applied option", () => {
    const onToggle = vi.fn();
    render(
      <LabelPickerField
        options={OPTIONS}
        onToggle={onToggle}
        canManageLabels={false}
      />,
    );

    fireEvent.click(screen.getByRole("option", { name: "Bug" }));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith("label-1", false);
  });
});

describe("LabelPickerField — Manage labels link, admins only (FR-018, research D-6)", () => {
  it("renders a link to /settings/labels for an admin", () => {
    render(
      <LabelPickerField
        options={OPTIONS}
        onToggle={vi.fn()}
        canManageLabels={true}
      />,
    );

    const link = screen.getByRole("link", { name: "Manage labels" });
    expect(link.getAttribute("href")).toBe("/settings/labels");
  });

  it("hides the link — does not disable it — for a non-admin", () => {
    render(
      <LabelPickerField
        options={OPTIONS}
        onToggle={vi.fn()}
        canManageLabels={false}
      />,
    );

    expect(screen.queryByRole("link", { name: "Manage labels" })).toBeNull();
  });
});

describe("LabelPickerField — disabled state (FR-019)", () => {
  it("disables the field and shows the given reason, calling no toggle", () => {
    const onToggle = vi.fn();
    render(
      <LabelPickerField
        options={OPTIONS}
        onToggle={onToggle}
        canManageLabels={false}
        isDisabled
        disabledReason="Only project members can change labels."
      />,
    );

    expect(screen.getByText("Only project members can change labels.")).toBeDefined();
    fireEvent.click(screen.getByRole("option", { name: "Feature" }));
    expect(onToggle).not.toHaveBeenCalled();
  });
});