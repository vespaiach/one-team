import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ResetTokenRecord } from "@/features/auth/server/reset-tokens";

vi.mock("@/features/auth/server/reset-tokens", () => ({
  resolveResetTokenState: vi.fn(),
}));
vi.mock("@/features/auth/actions", () => ({
  completePasswordReset: vi.fn(),
  requestPasswordReset: vi.fn(),
}));

import { resolveResetTokenState } from "@/features/auth/server/reset-tokens";
import ResetPage from "./page";

const RESET_TOKEN_ROW: ResetTokenRecord = {
  id: "0198c1c0-0000-7000-8000-000000000000",
  userId: "0198c1c0-0000-7000-8000-000000000001",
  tokenDigest: "0".repeat(64),
  expiresAt: new Date("2026-01-01T01:00:00.000Z"),
  usedAt: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("/reset page (FR-030, FR-034, FR-067)", () => {
  it("renders the reset-request form when no token is present", async () => {
    const jsx = await ResetPage({ searchParams: Promise.resolve({}) });
    render(jsx);

    expect(screen.getByLabelText(/email/i)).not.toBeNull();
    expect(resolveResetTokenState).not.toHaveBeenCalled();
  });

  it("renders the unknown-token state for an empty token, without a database lookup", async () => {
    const jsx = await ResetPage({ searchParams: Promise.resolve({ token: "" }) });
    render(jsx);

    expect(screen.getByRole("heading", { name: "This link isn't one we recognise" })).not.toBeNull();
    expect(resolveResetTokenState).not.toHaveBeenCalled();
  });

  it("renders the unknown-token state for a malformed token, without a database lookup", async () => {
    const jsx = await ResetPage({ searchParams: Promise.resolve({ token: "not a real token!" }) });
    render(jsx);

    expect(screen.getByRole("heading", { name: "This link isn't one we recognise" })).not.toBeNull();
    expect(resolveResetTokenState).not.toHaveBeenCalled();
  });

  it("resolves a well-shaped token server-side and renders the form for a valid token", async () => {
    vi.mocked(resolveResetTokenState).mockResolvedValue({ state: "valid", resetToken: RESET_TOKEN_ROW });

    const jsx = await ResetPage({ searchParams: Promise.resolve({ token: "a".repeat(43) }) });
    render(jsx);

    expect(screen.getByLabelText("New password")).not.toBeNull();
    expect(resolveResetTokenState).toHaveBeenCalledWith("a".repeat(43));
  });

  it("renders the expired notice for a token the server resolves as expired", async () => {
    vi.mocked(resolveResetTokenState).mockResolvedValue({ state: "expired", resetToken: RESET_TOKEN_ROW });

    const jsx = await ResetPage({ searchParams: Promise.resolve({ token: "a".repeat(43) }) });
    render(jsx);

    expect(screen.getByRole("heading", { name: "This link has expired" })).not.toBeNull();
  });

  it("renders the used notice for a token the server resolves as used", async () => {
    vi.mocked(resolveResetTokenState).mockResolvedValue({ state: "used", resetToken: RESET_TOKEN_ROW });

    const jsx = await ResetPage({ searchParams: Promise.resolve({ token: "a".repeat(43) }) });
    render(jsx);

    expect(screen.getByRole("heading", { name: "This link has already been used" })).not.toBeNull();
  });

  it("never echoes the raw token value into the rendered HTML", async () => {
    const secretToken = `${"a".repeat(40)}xyz`;
    vi.mocked(resolveResetTokenState).mockResolvedValue({ state: "expired", resetToken: RESET_TOKEN_ROW });

    const jsx = await ResetPage({ searchParams: Promise.resolve({ token: secretToken }) });
    const { container } = render(jsx);

    expect(container.innerHTML).not.toContain(secretToken);
  });
});