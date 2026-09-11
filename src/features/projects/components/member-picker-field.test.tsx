import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { RosterEntry } from "../server/queries";
import { MemberPickerField } from "./member-picker-field";

const ADA: RosterEntry = {
  userId: "u1",
  displayName: "Ada Lovelace",
  avatarUrl: null,
  jobTitle: null,
  deactivated: false,
};

const GRACE: RosterEntry = {
  userId: "u2",
  displayName: "Grace Hopper",
  avatarUrl: null,
  jobTitle: null,
  deactivated: false,
};

function openPicker() {
  fireEvent.click(screen.getByRole("button", { name: /Members/ }));
}

describe("MemberPickerField", () => {
  it("shows the Members label on the collapsed trigger when none are selected", () => {
    render(
      <MemberPickerField
        candidates={[ADA, GRACE]}
        selected={[]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /Members/ })).toBeTruthy();
  });

  it("lists available candidates once opened, excluding already-selected members", () => {
    render(
      <MemberPickerField
        candidates={[ADA, GRACE]}
        selected={[ADA]}
        onChange={vi.fn()}
      />,
    );

    openPicker();
    act(() => {
      screen.getByRole("combobox").focus();
    });

    expect(screen.getByRole("option", { name: "Grace Hopper" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Ada Lovelace" })).toBeNull();
  });

  it("adds a candidate to the selection when chosen from the list", () => {
    const onChange = vi.fn();
    render(
      <MemberPickerField
        candidates={[ADA, GRACE]}
        selected={[]}
        onChange={onChange}
      />,
    );

    openPicker();
    act(() => {
      screen.getByRole("combobox").focus();
    });
    fireEvent.click(screen.getByRole("option", { name: "Ada Lovelace" }));

    expect(onChange).toHaveBeenCalledWith([ADA]);
  });

  it("removes a selected member when their tag's remove button is pressed", () => {
    const onChange = vi.fn();
    render(
      <MemberPickerField
        candidates={[ADA, GRACE]}
        selected={[ADA]}
        onChange={onChange}
      />,
    );

    openPicker();
    fireEvent.click(screen.getByRole("button", { name: /Remove Ada Lovelace/ }));

    expect(onChange).toHaveBeenCalledWith([]);
  });
});