import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RosterEntry } from "../server/queries";
import { MemberPickerField } from "./member-picker-field";

afterEach(() => {
  vi.restoreAllMocks();
});

function entry(overrides: Partial<RosterEntry> = {}): RosterEntry {
  return {
    userId: crypto.randomUUID(),
    displayName: "Ada Lovelace",
    avatarUrl: null,
    jobTitle: null,
    deactivated: false,
    ...overrides,
  };
}

describe("MemberPickerField (FR-030, OT-AUTHZ-006)", () => {
  it("offers the candidates it is given", async () => {
    const ada = entry({ displayName: "Ada Lovelace" });
    const grace = entry({ displayName: "Grace Hopper" });
    render(
      <MemberPickerField
        candidates={[ada, grace]}
        selected={[]}
        onChange={vi.fn()}
      />,
    );

    const comboInput = screen.getByRole("combobox", { name: "Members" });
    fireEvent.focus(comboInput);
    fireEvent.keyDown(comboInput, { key: "ArrowDown" });

    expect(await screen.findByRole("option", { name: "Ada Lovelace" })).toBeDefined();
    expect(await screen.findByRole("option", { name: "Grace Hopper" })).toBeDefined();
  });

  it("does not offer a candidate absent from the list — deactivated accounts and the creating admin are excluded upstream", async () => {
    const ada = entry({ displayName: "Ada Lovelace" });
    render(
      <MemberPickerField
        candidates={[ada]}
        selected={[]}
        onChange={vi.fn()}
      />,
    );

    const comboInput = screen.getByRole("combobox", { name: "Members" });
    fireEvent.focus(comboInput);
    fireEvent.keyDown(comboInput, { key: "ArrowDown" });

    expect(await screen.findByRole("option", { name: "Ada Lovelace" })).toBeDefined();
    expect(screen.queryByRole("option", { name: "Bea Closed" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Signed-in Admin" })).toBeNull();
  });

  it("offers no invitation path", () => {
    render(
      <MemberPickerField
        candidates={[]}
        selected={[]}
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByText(/invite/i)).toBeNull();
  });

  it("turns a chosen person into a removable chip", async () => {
    const ada = entry({ displayName: "Ada Lovelace" });
    const onChange = vi.fn();
    render(
      <MemberPickerField
        candidates={[ada]}
        selected={[]}
        onChange={onChange}
      />,
    );

    const comboInput = screen.getByRole("combobox", { name: "Members" });
    fireEvent.focus(comboInput);
    fireEvent.keyDown(comboInput, { key: "ArrowDown" });
    const option = await screen.findByRole("option", { name: "Ada Lovelace" });
    fireEvent.click(option);

    expect(onChange).toHaveBeenCalledWith([ada]);
  });

  it("removes a chip on its remove button, reporting the remaining selection", () => {
    const ada = entry({ displayName: "Ada Lovelace" });
    const grace = entry({ displayName: "Grace Hopper" });
    const onChange = vi.fn();
    render(
      <MemberPickerField
        candidates={[ada, grace]}
        selected={[ada, grace]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Remove Ada Lovelace/i }));

    expect(onChange).toHaveBeenCalledWith([grace]);
  });
});