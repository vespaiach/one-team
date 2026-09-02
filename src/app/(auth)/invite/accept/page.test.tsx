import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { InvitationRecord } from "@/features/accounts/server/invitations";

vi.mock("@/features/accounts/server/invitations", () => ({
  resolveInvitationState: vi.fn(),
}));
vi.mock("@/features/accounts/actions", () => ({
  acceptInvitation: vi.fn(),
}));

import { resolveInvitationState } from "@/features/accounts/server/invitations";
import AcceptInvitationPage from "./page";

const INVITATION_ROW: InvitationRecord = {
  id: "0198c1c0-0000-7000-8000-000000000000",
  email: "invitee@example.com",
  invitedBy: "0198c1c0-0000-7000-8000-000000000001",
  tokenDigest: "0".repeat(64),
  expiresAt: new Date("2026-01-08T00:00:00.000Z"),
  acceptedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("/invite/accept page (FR-024a, FR-025, FR-032, FR-033, FR-060)", () => {
  it("renders the unknown state for an empty token, without a database lookup", async () => {
    const jsx = await AcceptInvitationPage({ searchParams: Promise.resolve({}) });
    render(jsx);

    expect(screen.getByRole("heading", { name: "This link isn't one we recognise" })).not.toBeNull();
    expect(resolveInvitationState).not.toHaveBeenCalled();
  });

  it("renders the unknown state for a malformed token, without a database lookup", async () => {
    const jsx = await AcceptInvitationPage({ searchParams: Promise.resolve({ token: "not a real token!" }) });
    render(jsx);

    expect(screen.getByRole("heading", { name: "This link isn't one we recognise" })).not.toBeNull();
    expect(resolveInvitationState).not.toHaveBeenCalled();
  });

  it("resolves a well-shaped token server-side and renders the form for a valid invitation", async () => {
    vi.mocked(resolveInvitationState).mockResolvedValue({ state: "valid", invitation: INVITATION_ROW });

    const jsx = await AcceptInvitationPage({ searchParams: Promise.resolve({ token: "a".repeat(43) }) });
    render(jsx);

    expect(screen.getByLabelText(/first name/i)).not.toBeNull();
    expect(resolveInvitationState).toHaveBeenCalledWith("a".repeat(43));
  });

  it("shows the invited address from the invitation, not from a user lookup", async () => {
    vi.mocked(resolveInvitationState).mockResolvedValue({ state: "valid", invitation: INVITATION_ROW });

    const jsx = await AcceptInvitationPage({ searchParams: Promise.resolve({ token: "a".repeat(43) }) });
    render(jsx);

    expect(screen.getByText("invitee@example.com")).not.toBeNull();
  });

  it("renders the expired notice for a token the server resolves as expired", async () => {
    vi.mocked(resolveInvitationState).mockResolvedValue({ state: "expired", invitation: INVITATION_ROW });

    const jsx = await AcceptInvitationPage({ searchParams: Promise.resolve({ token: "a".repeat(43) }) });
    render(jsx);

    expect(screen.getByRole("heading", { name: "This link has expired" })).not.toBeNull();
  });

  it("renders the used notice for a token the server resolves as used", async () => {
    vi.mocked(resolveInvitationState).mockResolvedValue({ state: "used", invitation: INVITATION_ROW });

    const jsx = await AcceptInvitationPage({ searchParams: Promise.resolve({ token: "a".repeat(43) }) });
    render(jsx);

    expect(screen.getByRole("heading", { name: "This link has already been used" })).not.toBeNull();
  });

  it("renders the unknown notice for a token the server resolves as unknown", async () => {
    vi.mocked(resolveInvitationState).mockResolvedValue({ state: "unknown", invitation: null });

    const jsx = await AcceptInvitationPage({ searchParams: Promise.resolve({ token: "a".repeat(43) }) });
    render(jsx);

    expect(screen.getByRole("heading", { name: "This link isn't one we recognise" })).not.toBeNull();
  });

  it("never echoes the raw token value into the rendered HTML", async () => {
    const secretToken = `${"a".repeat(40)}xyz`;
    vi.mocked(resolveInvitationState).mockResolvedValue({ state: "expired", invitation: INVITATION_ROW });

    const jsx = await AcceptInvitationPage({ searchParams: Promise.resolve({ token: secretToken }) });
    const { container } = render(jsx);

    expect(container.innerHTML).not.toContain(secretToken);
  });
});