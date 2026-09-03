import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RosterEntry } from "../server/queries";
import type { MembersSectionAdmin } from "./members-section";
import { MembersSection } from "./members-section";

const showToastMock = vi.fn();
vi.mock("@/features/shell/components/toast-region", () => ({
  showToast: (...args: unknown[]) => showToastMock(...args),
}));

beforeEach(() => {
  showToastMock.mockClear();
});

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

function adminProps(overrides: Partial<MembersSectionAdmin> = {}): MembersSectionAdmin {
  return {
    projectKey: "WR",
    candidates: [],
    addProjectMemberAction: vi.fn().mockResolvedValue({ status: "saved" }),
    removeProjectMemberAction: vi.fn().mockResolvedValue({ status: "saved" }),
    ...overrides,
  };
}

const ROSTER: RosterEntry[] = [
  { userId: "1", displayName: "Ada Lovelace", avatarUrl: null, jobTitle: "Engineer", deactivated: false },
  { userId: "2", displayName: "Grace Hopper", avatarUrl: null, jobTitle: null, deactivated: true },
];

describe("MembersSection (FR-018, FR-045)", () => {
  it("lists membership rows only", () => {
    render(<MembersSection roster={ROSTER} />);

    expect(screen.getByText("Ada Lovelace")).not.toBeNull();
    expect(screen.getByText("Grace Hopper")).not.toBeNull();
  });

  it("keeps a deactivated member's row present", () => {
    render(<MembersSection roster={ROSTER} />);

    const rows = screen.getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining("Grace Hopper") as string]),
    );
  });
});

describe("MembersSection — add and remove, admin only (FR-045, US3)", () => {
  it("disables add and remove with an inline reason when no admin capability is given", () => {
    render(<MembersSection roster={[ROSTER[0] as RosterEntry]} />);

    const addInput = screen.getByRole("combobox", { name: "Add member" });
    expect(addInput.hasAttribute("disabled")).toBe(true);

    const removeButton = screen.getByRole("button", { name: "Remove Ada Lovelace" });
    expect(removeButton.hasAttribute("disabled")).toBe(true);

    expect(screen.getByText(/admin/i)).not.toBeNull();
  });

  it("offers add and remove, enabled, to an admin", () => {
    render(
      <MembersSection
        roster={[ROSTER[0] as RosterEntry]}
        admin={adminProps()}
      />,
    );

    const addInput = screen.getByRole("combobox", { name: "Add member" });
    expect(addInput.hasAttribute("disabled")).toBe(false);

    const removeButton = screen.getByRole("button", { name: "Remove Ada Lovelace" });
    expect(removeButton.hasAttribute("disabled")).toBe(false);
  });

  it("offers the given candidates in the Add picker, excluding anyone already on the roster, while including the acting admin", async () => {
    const alreadyMember = entry({ userId: "1", displayName: "Ada Lovelace" });
    const actingAdmin = entry({ userId: "admin-1", displayName: "Signed-in Admin" });
    const candidate = entry({ userId: "2", displayName: "Grace Hopper" });

    render(
      <MembersSection
        roster={[alreadyMember]}
        admin={adminProps({ candidates: [alreadyMember, actingAdmin, candidate] })}
      />,
    );

    const comboInput = screen.getByRole("combobox", { name: "Add member" });
    fireEvent.focus(comboInput);
    fireEvent.keyDown(comboInput, { key: "ArrowDown" });

    expect(await screen.findByRole("option", { name: "Grace Hopper" })).toBeDefined();
    expect(await screen.findByRole("option", { name: "Signed-in Admin" })).toBeDefined();
    expect(screen.queryByRole("option", { name: "Ada Lovelace" })).toBeNull();
  });

  it("offers no invitation path", () => {
    render(
      <MembersSection
        roster={[]}
        admin={adminProps()}
      />,
    );

    expect(screen.queryByText(/invite/i)).toBeNull();
  });

  it("rolls back to the previous roster and shows a message when the server refuses an add", async () => {
    const candidate = entry({ userId: "2", displayName: "Grace Hopper" });
    const addProjectMemberAction = vi.fn().mockResolvedValue({ status: "forbidden" });

    render(
      <MembersSection
        roster={[]}
        admin={adminProps({ candidates: [candidate], addProjectMemberAction })}
      />,
    );

    const comboInput = screen.getByRole("combobox", { name: "Add member" });
    fireEvent.focus(comboInput);
    fireEvent.keyDown(comboInput, { key: "ArrowDown" });
    const option = await screen.findByRole("option", { name: "Grace Hopper" });
    fireEvent.click(option);

    await waitFor(() =>
      expect(addProjectMemberAction).toHaveBeenCalledWith({ projectKey: "WR", userId: "2" }),
    );
    await waitFor(() => expect(screen.queryByText("Grace Hopper")).toBeNull());
    expect(showToastMock).toHaveBeenCalledWith({
      kind: "error",
      message: expect.stringContaining("Grace Hopper") as string,
    });
  });
});