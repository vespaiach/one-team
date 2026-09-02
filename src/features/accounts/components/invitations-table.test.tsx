import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { InvitationRow } from "../server/roster";
import { InvitationsTable } from "./invitations-table";

const ROW: InvitationRow = {
  id: "inv-1",
  email: "invitee@example.com",
  invitedByName: "Grace Hopper",
  sentAt: new Date("2026-01-01T00:00:00.000Z"),
  expiresAt: new Date("2026-01-08T00:00:00.000Z"),
  isExpired: false,
};

describe("InvitationsTable (FR-018, FR-019, FR-022, FR-023)", () => {
  it("shows address, inviter, sent and expires with both controls", () => {
    render(
      <InvitationsTable
        rows={[ROW]}
        onResend={vi.fn()}
        onRevoke={vi.fn()}
      />,
    );

    expect(screen.getByText("invitee@example.com")).not.toBeNull();
    expect(screen.getByText("Grace Hopper")).not.toBeNull();
    expect(screen.getByRole("button", { name: /resend/i })).not.toBeNull();
    expect(screen.getByRole("button", { name: /revoke/i })).not.toBeNull();
  });

  it("marks an expired row in text rather than colour alone, while still offering Resend", () => {
    render(
      <InvitationsTable
        rows={[{ ...ROW, isExpired: true }]}
        onResend={vi.fn()}
        onRevoke={vi.fn()}
      />,
    );

    expect(screen.getByText(/expired/i)).not.toBeNull();
    expect(screen.getByRole("button", { name: /resend/i })).not.toBeNull();
  });

  it("renders exactly 'No outstanding invitations' when empty", () => {
    render(
      <InvitationsTable
        rows={[]}
        onResend={vi.fn()}
        onRevoke={vi.fn()}
      />,
    );

    expect(screen.getByText("No outstanding invitations")).not.toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("formats dates against a fixed UTC calendar day, not the reader's local timezone", () => {
    render(
      <InvitationsTable
        rows={[{ ...ROW, sentAt: new Date("2026-09-02T02:00:00.000Z") }]}
        onResend={vi.fn()}
        onRevoke={vi.fn()}
      />,
    );

    expect(screen.getByText("Sep 2, 2026")).not.toBeNull();
  });

  it("calls onResend and onRevoke with the row's id", () => {
    const onResend = vi.fn();
    const onRevoke = vi.fn();
    render(
      <InvitationsTable
        rows={[ROW]}
        onResend={onResend}
        onRevoke={onRevoke}
      />,
    );

    screen.getByRole("button", { name: /resend/i }).click();
    screen.getByRole("button", { name: /revoke/i }).click();

    expect(onResend).toHaveBeenCalledWith("inv-1");
    expect(onRevoke).toHaveBeenCalledWith("inv-1");
  });
});