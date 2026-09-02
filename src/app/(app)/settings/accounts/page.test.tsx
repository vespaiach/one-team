import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/server/actor", () => ({
  requireActor: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  forbidden: vi.fn(() => {
    throw new Error("NEXT_FORBIDDEN");
  }),
}));
vi.mock("@/features/accounts/server/roster", () => ({
  listOutstandingInvitations: vi.fn().mockResolvedValue([]),
  loadRoster: vi.fn().mockResolvedValue({ rows: [], activeAdminCount: 1 }),
}));
vi.mock("@/features/accounts/actions", () => ({
  checkInviteAddress: vi.fn(),
  inviteUser: vi.fn(),
  resendInvite: vi.fn(),
  revokeInvite: vi.fn(),
  deactivateUser: vi.fn(),
  reactivateUser: vi.fn(),
}));

import { forbidden } from "next/navigation";
import { requireActor } from "@/features/auth/server/actor";
import AccountsPage from "./page";

afterEach(() => {
  vi.clearAllMocks();
});

describe("/settings/accounts page (FR-002, OT-SEC-015, US3 s6, s7)", () => {
  it("redirects an unauthenticated caller to /signin and never reaches Forbidden", async () => {
    vi.mocked(requireActor).mockImplementation(() => {
      throw new Error("NEXT_REDIRECT:/signin");
    });

    await expect(AccountsPage()).rejects.toThrow("NEXT_REDIRECT:/signin");
    expect(forbidden).not.toHaveBeenCalled();
  });

  it("gives a signed-in member the Forbidden screen at this URL", async () => {
    vi.mocked(requireActor).mockResolvedValue({
      id: "member-1",
      role: "member",
      firstName: "Ada",
      lastName: "Lovelace",
      avatarUrl: null,
      mustChangePassword: false,
    });

    await expect(AccountsPage()).rejects.toThrow("NEXT_FORBIDDEN");
    expect(forbidden).toHaveBeenCalled();
  });

  it("renders the screen for a signed-in admin", async () => {
    vi.mocked(requireActor).mockResolvedValue({
      id: "admin-1",
      role: "admin",
      firstName: "Ada",
      lastName: "Lovelace",
      avatarUrl: null,
      mustChangePassword: false,
    });

    const jsx = await AccountsPage();

    expect(jsx).toBeDefined();
    expect(forbidden).not.toHaveBeenCalled();
  });
});