import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AddressCheck, InviteState } from "../actions";
import type { InvitationRow, RosterView } from "../server/roster";
import { AccountsScreen } from "./accounts-screen";

const INVITATION: InvitationRow = {
  id: "inv-1",
  email: "invitee@example.com",
  invitedByName: "Grace Hopper",
  sentAt: new Date("2026-01-01T00:00:00.000Z"),
  expiresAt: new Date("2026-01-08T00:00:00.000Z"),
  isExpired: false,
};

const ROSTER: RosterView = {
  rows: [
    {
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
    },
  ],
  activeAdminCount: 1,
};

function renderScreen(overrides: Partial<Parameters<typeof AccountsScreen>[0]> = {}) {
  const inviteAction = vi.fn().mockResolvedValue({ status: "idle" } as InviteState);
  const checkAddress = vi.fn().mockResolvedValue({ result: "ok" } as AddressCheck);
  const resend = vi.fn().mockResolvedValue({ status: "done", mailed: true });
  const revoke = vi.fn().mockResolvedValue({ status: "done" });
  const deactivate = vi.fn().mockResolvedValue({ status: "done" });
  const reactivate = vi.fn().mockResolvedValue({ status: "done" });

  render(
    <AccountsScreen
      invitations={[INVITATION]}
      roster={ROSTER}
      inviteAction={inviteAction}
      checkAddress={checkAddress}
      resendInvite={resend}
      revokeInvite={revoke}
      deactivateUser={deactivate}
      reactivateUser={reactivate}
      {...overrides}
    />,
  );

  return { inviteAction, checkAddress, resend, revoke, deactivate, reactivate };
}

describe("AccountsScreen (FR-003, FR-003a, FR-008, FR-008b)", () => {
  it("selects Invitations on arrival", () => {
    renderScreen();

    const invitationsTab = screen.getByRole("tab", { name: /invitations/i });
    expect(invitationsTab.getAttribute("aria-selected")).toBe("true");
  });

  it("does not move the tab when a write completes", async () => {
    const { revoke } = renderScreen();

    fireEvent.click(screen.getByRole("button", { name: /revoke/i }));
    await vi.waitFor(() => expect(revoke).toHaveBeenCalled());

    const invitationsTab = screen.getByRole("tab", { name: /invitations/i });
    expect(invitationsTab.getAttribute("aria-selected")).toBe("true");
  });

  it("mounts no toast region or connection banner of its own — the app-wide shell instance is the only one", () => {
    renderScreen();

    expect(screen.queryByRole("region", { name: /notifications/i, hidden: true })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("FR-008's control closes the modal, switches to Accounts, and highlights the reached row, with no URL change", async () => {
    const checkAddress = vi.fn().mockResolvedValue({
      result: "has_account",
      accountId: "acc-1",
      displayName: "Grace Hopper",
      isDeactivated: false,
    } as AddressCheck);
    renderScreen({ checkAddress });
    const startUrl = window.location.href;

    fireEvent.click(screen.getByRole("button", { name: /^invite$/i }));
    const field = await screen.findByLabelText(/email/i);
    fireEvent.change(field, { target: { value: "grace@example.com" } });
    fireEvent.blur(field);
    const jumpButton = await screen.findByRole("button", { name: /grace hopper/i });
    fireEvent.click(jumpButton);

    expect(screen.queryByRole("dialog")).toBeNull();
    const accountsTab = screen.getByRole("tab", { name: /^accounts$/i });
    expect(accountsTab.getAttribute("aria-selected")).toBe("true");
    const row = screen.getByText("Grace Hopper", { selector: "td" }).closest("tr");
    expect(row?.getAttribute("data-highlighted")).toBe("true");
    expect(window.location.href).toBe(startUrl);
  });
});

describe("AccountsScreen — read failure (FR-055a)", () => {
  it("renders an explanatory state with a retry when the invitations read failed, never an empty list or a stuck skeleton", () => {
    renderScreen({ invitations: null });

    expect(screen.getByText(/could not be loaded/i)).not.toBeNull();
    expect(screen.getByRole("button", { name: /retry/i })).not.toBeNull();
    expect(screen.queryByText("No outstanding invitations")).toBeNull();
  });

  it("leaves the Accounts tab intact when only the roster read failed", () => {
    renderScreen({ roster: null });

    fireEvent.click(screen.getByRole("tab", { name: /^accounts$/i }));

    expect(screen.getByText(/could not be loaded/i)).not.toBeNull();
    expect(screen.getByRole("button", { name: /retry/i })).not.toBeNull();
  });
});