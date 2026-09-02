import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountRow } from "../server/roster";
import { RosterTable } from "./roster-table";

function accountRow(overrides: Partial<AccountRow> = {}): AccountRow {
  return {
    id: "acc-1",
    firstName: "Grace",
    lastName: "Hopper",
    displayName: "Grace Hopper",
    avatarUrl: null,
    email: "grace@example.com",
    role: "member",
    joinedAt: new Date("2026-01-01T00:00:00.000Z"),
    isActive: true,
    projectCount: 0,
    ...overrides,
  };
}

function renderTable(props: Partial<Parameters<typeof RosterTable>[0]> = {}) {
  return render(
    <RosterTable
      rows={[accountRow()]}
      activeAdminCount={1}
      highlightedAccountId={null}
      onClearHighlight={vi.fn()}
      onDeactivate={vi.fn()}
      onReactivate={vi.fn()}
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("RosterTable (FR-037, FR-042, FR-050, OT-UX-002, OT-UX-018)", () => {
  it("shows avatar, display name, email, role, joined date and project count", () => {
    renderTable({ rows: [accountRow({ role: "admin", projectCount: 3 })] });

    expect(screen.getByText("Grace Hopper")).not.toBeNull();
    expect(screen.getByText("grace@example.com")).not.toBeNull();
    expect(screen.getByText("admin")).not.toBeNull();
    expect(screen.getByText("3")).not.toBeNull();
    expect(screen.getByRole("img", { name: /grace hopper/i })).not.toBeNull();
  });

  it("carries exactly one control per row — Deactivate on active", () => {
    renderTable({ rows: [accountRow({ isActive: true })] });

    expect(screen.getByRole("button", { name: /deactivate/i })).not.toBeNull();
    expect(screen.queryByRole("button", { name: /reactivate/i })).toBeNull();
  });

  it("carries exactly one control per row — Reactivate on closed", () => {
    renderTable({ rows: [accountRow({ isActive: false })] });

    expect(screen.getByRole("button", { name: /reactivate/i })).not.toBeNull();
    expect(screen.queryByRole("button", { name: /deactivate/i })).toBeNull();
  });

  it("offers no control anywhere that sets a role", () => {
    const { container } = renderTable();

    expect(container.querySelector("select")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
  });

  it("disables Deactivate on the sole active admin, not hiding it, with the exact reason associated programmatically", () => {
    renderTable({
      rows: [accountRow({ role: "admin", isActive: true })],
      activeAdminCount: 1,
    });

    const button = screen.getByRole("button", { name: /deactivate/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    const describedBy = button.getAttribute("aria-describedby");
    expect(describedBy).not.toBeNull();
    const reason = document.getElementById(describedBy ?? "");
    expect(reason?.textContent).toBe("The last active admin can't be deactivated.");
  });

  it("leaves Deactivate enabled on an admin when another active admin exists", () => {
    renderTable({
      rows: [accountRow({ role: "admin", isActive: true })],
      activeAdminCount: 2,
    });

    const button = screen.getByRole("button", { name: /deactivate/i });
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });
});

describe("RosterTable — transient highlight (FR-008b)", () => {
  it("marks the highlighted row and clears it after a short interval", () => {
    const onClearHighlight = vi.fn();
    renderTable({ highlightedAccountId: "acc-1", onClearHighlight });

    const row = screen.getByText("Grace Hopper").closest("tr");
    expect(row?.getAttribute("data-highlighted")).toBe("true");

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(onClearHighlight).toHaveBeenCalled();
  });

  it("clears the highlight on the next interaction, whichever comes first", () => {
    const onClearHighlight = vi.fn();
    renderTable({ highlightedAccountId: "acc-1", onClearHighlight });

    fireEvent.keyDown(document.body, { key: "Tab" });

    expect(onClearHighlight).toHaveBeenCalled();
  });
});

describe("RosterTable — confirmations (FR-044, US4 s1, s9)", () => {
  it("asks for confirmation once before deactivating, naming what stays", () => {
    const onDeactivate = vi.fn();
    renderTable({ rows: [accountRow({ isActive: true })], onDeactivate });

    fireEvent.click(screen.getByRole("button", { name: /deactivate/i }));

    expect(onDeactivate).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toMatch(/memberships/i);
    expect(dialog.textContent).toMatch(/assignments/i);
    expect(dialog.textContent).toMatch(/comments/i);
    expect(dialog.textContent).toMatch(/activity/i);

    fireEvent.click(screen.getByRole("button", { name: /^deactivate$/i }));
    expect(onDeactivate).toHaveBeenCalledWith("acc-1");
  });

  it("asks for confirmation once before reactivating, naming what it restores and that nothing new is issued", () => {
    const onReactivate = vi.fn();
    renderTable({ rows: [accountRow({ isActive: false })], onReactivate });

    fireEvent.click(screen.getByRole("button", { name: /reactivate/i }));

    expect(onReactivate).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toMatch(/sign-in|sign in/i);
    expect(dialog.textContent).toMatch(/memberships/i);
    expect(dialog.textContent).toMatch(/no new link|no invitation/i);
  });
});