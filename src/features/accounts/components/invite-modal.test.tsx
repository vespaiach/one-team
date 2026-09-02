import { fireEvent, render, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { AddressCheck, InviteState } from "../actions";
import { InviteModal } from "./invite-modal";

function openModal(props: Partial<Parameters<typeof InviteModal>[0]> = {}) {
  const action = vi.fn().mockResolvedValue({ status: "idle" } as InviteState);
  const checkAddress = vi.fn().mockResolvedValue({ result: "ok" } as AddressCheck);
  render(
    <InviteModal
      action={action}
      checkAddress={checkAddress}
      onCreated={vi.fn()}
      onJumpToAccount={vi.fn()}
      onResendInvitation={vi.fn()}
      {...props}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /invite/i }));
  return { action, checkAddress };
}

describe("InviteModal (FR-005…FR-011, FR-059)", () => {
  it("carries one field and nothing else besides the submit control", () => {
    openModal();

    const dialog = screen.getByRole("dialog");
    expect(screen.getByLabelText(/email/i)).not.toBeNull();
    expect(dialog.querySelectorAll("input")).toHaveLength(1);
  });

  it("validates on blur and stays enabled while the field is invalid", async () => {
    const checkAddress = vi.fn().mockResolvedValue({ result: "malformed" } as AddressCheck);
    openModal({ checkAddress });

    const field = screen.getByLabelText(/email/i);
    fireEvent.change(field, { target: { value: "not-an-email" } });
    fireEvent.blur(field);

    expect(await screen.findByText(/valid email address/i)).not.toBeNull();
    const submit = screen.getByRole("button", { name: /^invite$|^send$/i });
    expect((submit as HTMLButtonElement).disabled).toBe(false);
  });

  it("names an active account and offers the control that reaches its row", async () => {
    const onJumpToAccount = vi.fn();
    const checkAddress = vi.fn().mockResolvedValue({
      result: "has_account",
      accountId: "acc-1",
      displayName: "Grace Hopper",
      isDeactivated: false,
    } as AddressCheck);
    openModal({ checkAddress, onJumpToAccount });

    const field = screen.getByLabelText(/email/i);
    fireEvent.change(field, { target: { value: "grace@example.com" } });
    fireEvent.blur(field);

    const jumpButton = await screen.findByRole("button", { name: /grace hopper/i });
    expect(screen.getByText(/already has an account/i)).not.toBeNull();
    fireEvent.click(jumpButton);

    expect(onJumpToAccount).toHaveBeenCalledWith("acc-1");
  });

  it("names a deactivated account as closed and offers Reactivate as the remedy", async () => {
    const checkAddress = vi.fn().mockResolvedValue({
      result: "has_account",
      accountId: "acc-2",
      displayName: "Ada Lovelace",
      isDeactivated: true,
    } as AddressCheck);
    openModal({ checkAddress });

    const field = screen.getByLabelText(/email/i);
    fireEvent.change(field, { target: { value: "ada@example.com" } });
    fireEvent.blur(field);

    expect(await screen.findByText(/closed/i)).not.toBeNull();
    expect(screen.getByRole("button", { name: /reactivate/i })).not.toBeNull();
  });

  it("names an outstanding invitation and offers Resend in place of a second invitation", async () => {
    const onResendInvitation = vi.fn();
    const checkAddress = vi.fn().mockResolvedValue({
      result: "has_invitation",
      invitationId: "inv-1",
    } as AddressCheck);
    openModal({ checkAddress, onResendInvitation });

    const field = screen.getByLabelText(/email/i);
    fireEvent.change(field, { target: { value: "invitee@example.com" } });
    fireEvent.blur(field);

    expect(await screen.findByText(/already.*invit|outstanding/i)).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /resend/i }));

    expect(onResendInvitation).toHaveBeenCalledWith("inv-1");
  });

  it("discards the field and closes on Cancel", () => {
    openModal();

    const field = screen.getByLabelText(/email/i);
    fireEvent.change(field, { target: { value: "someone@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("discards the field and closes on Escape", () => {
    openModal();

    const field = screen.getByLabelText(/email/i);
    fireEvent.change(field, { target: { value: "someone@example.com" } });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not close on a press outside the dialog", () => {
    openModal();

    fireEvent.mouseDown(document.body);
    fireEvent.click(document.body);

    expect(screen.queryByRole("dialog")).not.toBeNull();
  });

  it("shows in-flight state only while the write is outstanding", async () => {
    let resolveAction: (value: InviteState) => void = () => undefined;
    const action = vi.fn().mockImplementation(
      () =>
        new Promise<InviteState>((resolve) => {
          resolveAction = resolve;
        }),
    );
    openModal({ action });

    const field = screen.getByLabelText(/email/i);
    fireEvent.change(field, { target: { value: "fresh@example.com" } });
    const form = screen.getByRole("dialog").querySelector("form");
    if (!form) {
      throw new Error("no form found");
    }
    fireEvent.submit(form);

    const submit = await screen.findByRole("button", { name: /sending|inviting/i });
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    resolveAction({ status: "created", mailed: true });
  });

  it("calls onCreated exactly once under StrictMode's double effect invocation", async () => {
    const action = vi.fn().mockResolvedValue({ status: "created", mailed: true } as InviteState);
    const onCreated = vi.fn();
    const checkAddress = vi.fn().mockResolvedValue({ result: "ok" } as AddressCheck);
    render(
      <StrictMode>
        <InviteModal
          action={action}
          checkAddress={checkAddress}
          onCreated={onCreated}
          onJumpToAccount={vi.fn()}
          onResendInvitation={vi.fn()}
        />
      </StrictMode>,
    );
    fireEvent.click(screen.getByRole("button", { name: /invite/i }));

    const field = screen.getByLabelText(/email/i);
    fireEvent.change(field, { target: { value: "fresh@example.com" } });
    const form = screen.getByRole("dialog").querySelector("form");
    if (!form) {
      throw new Error("no form found");
    }
    fireEvent.submit(form);

    await vi.waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(onCreated).toHaveBeenCalledTimes(1);
  });
});