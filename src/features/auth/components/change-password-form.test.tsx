import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CompletePasswordResetState } from "../actions";
import { ChangePasswordForm } from "./change-password-form";

function renderForm(initialState: CompletePasswordResetState, action = vi.fn()) {
  render(
    <ChangePasswordForm
      action={action}
      initialState={initialState}
    />,
  );
  return action;
}

function submit() {
  const form = screen.getByRole("button", { name: /change password/i }).closest("form");
  if (!form) {
    throw new Error("no form found");
  }
  fireEvent.submit(form);
}

describe("ChangePasswordForm (FR-034, FR-035, FR-036, OT-SEC-016)", () => {
  it("renders New password and Confirm password fields", () => {
    renderForm({ status: "idle" });

    expect(screen.getByLabelText("New password")).not.toBeNull();
    expect(screen.getByLabelText("Confirm password")).not.toBeNull();
  });

  it("shows an inline mismatch error on Confirm password when the two fields differ", async () => {
    const action = vi.fn().mockResolvedValue({ status: "mismatch" });
    renderForm({ status: "idle" }, action);

    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "a-compliant-password-1" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "a-different-password-2" },
    });
    submit();

    expect(await screen.findByText(/don't match/i)).not.toBeNull();
  });

  it("names the too_short rule and nothing else", async () => {
    const action = vi.fn().mockResolvedValue({ status: "policy", failure: "too_short" });
    renderForm({ status: "idle" }, action);

    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "short1" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "short1" } });
    submit();

    expect(await screen.findByText(/at least 12/i)).not.toBeNull();
  });

  it("names the too_long rule and nothing else", async () => {
    const action = vi.fn().mockResolvedValue({ status: "policy", failure: "too_long" });
    renderForm({ status: "idle" }, action);

    const value = "a".repeat(129);
    fireEvent.change(screen.getByLabelText("New password"), { target: { value } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value } });
    submit();

    expect(await screen.findByText(/no more than 128/i)).not.toBeNull();
  });

  it("names the blocklisted rule and nothing else", async () => {
    const action = vi.fn().mockResolvedValue({ status: "policy", failure: "blocklisted" });
    renderForm({ status: "idle" }, action);

    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "password123" } });
    submit();

    expect(await screen.findByText(/too common/i)).not.toBeNull();
  });

  it("renders a distinguishable expired-token notice with a route back to /reset", () => {
    renderForm({ status: "expired" });

    expect(screen.getByText("This link has expired. Reset links last one hour.")).not.toBeNull();
    const link = screen.getByRole("link", { name: /request a new link/i });
    expect(link.getAttribute("href")).toBe("/reset");
  });

  it("renders a distinguishable used-token notice with a route back to /reset", () => {
    renderForm({ status: "used" });

    expect(
      screen.getByText("This link has already been used. Your password was changed with it."),
    ).not.toBeNull();
    const link = screen.getByRole("link", { name: /request a new link/i });
    expect(link.getAttribute("href")).toBe("/reset");
  });

  it("renders a distinguishable unknown-token notice with a route back to /reset", () => {
    renderForm({ status: "unknown" });

    expect(
      screen.getByText(
        "This link isn't one we recognise. Check the whole address came across from the email.",
      ),
    ).not.toBeNull();
    const link = screen.getByRole("link", { name: /request a new link/i });
    expect(link.getAttribute("href")).toBe("/reset");
  });

  it("no form renders once the token state is expired, used or unknown", () => {
    renderForm({ status: "expired" });

    expect(screen.queryByLabelText("New password")).toBeNull();
    expect(screen.queryByRole("button", { name: /change password/i })).toBeNull();
  });
});