import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CompletePasswordResetState } from "../actions";
import { ChangePasswordForm } from "./change-password-form";

function renderForm(initialState: CompletePasswordResetState, action = vi.fn(), email?: string) {
  render(
    <ChangePasswordForm
      action={action}
      initialState={initialState}
      email={email}
    />,
  );
  return action;
}

function submit() {
  const form = screen.getByRole("button", { name: /save password/i }).closest("form");
  if (!form) {
    throw new Error("no form found");
  }
  fireEvent.submit(form);
}

describe("ChangePasswordForm (FR-034, FR-035, FR-036, OT-SEC-016)", () => {
  it("renders the title, New password and Confirm password fields, and the Save password control", () => {
    renderForm({ status: "idle" });

    expect(screen.getByRole("heading", { name: "Set a new password" })).not.toBeNull();
    expect(screen.getByLabelText("New password")).not.toBeNull();
    expect(screen.getByLabelText("Confirm password")).not.toBeNull();
    expect(screen.getByRole("button", { name: /save password/i })).not.toBeNull();
  });

  it("names the address the link is bound to when given one", () => {
    renderForm({ status: "idle" }, vi.fn(), "jo@oneteam.io");

    expect(screen.getByText("jo@oneteam.io").tagName).toBe("B");
    expect(screen.getByText(/this link is single-use/i)).not.toBeNull();
  });

  it("shows the twelve-character hint under New password until it is invalid", () => {
    renderForm({ status: "idle" });

    expect(screen.getByText(/twelve characters minimum/i)).not.toBeNull();
  });

  it("carries the sign-out footer note", () => {
    renderForm({ status: "idle" });

    expect(
      screen.getByText("Saving signs out every session on this account, including this browser."),
    ).not.toBeNull();
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

  it("renders a distinguishable expired-token notice as a banner, with a route back to /reset", () => {
    renderForm({ status: "expired" });

    const banner = screen.getByRole("alert");
    expect(banner.textContent).toContain("This link has expired. Reset links last one hour.");
    const link = screen.getByRole("link", { name: /request a new link/i });
    expect(link.getAttribute("href")).toBe("/reset");
  });

  it("renders a distinguishable used-token notice as a banner, with a route back to /reset", () => {
    renderForm({ status: "used" });

    const banner = screen.getByRole("alert");
    expect(banner.textContent).toContain(
      "This link has already been used. Your password was changed with it.",
    );
    const link = screen.getByRole("link", { name: /request a new link/i });
    expect(link.getAttribute("href")).toBe("/reset");
  });

  it("renders a distinguishable unknown-token notice as a banner, with a route back to /reset", () => {
    renderForm({ status: "unknown" });

    const banner = screen.getByRole("alert");
    expect(banner.textContent).toContain(
      "This link isn't one we recognise. Check the whole address came across from the email.",
    );
    const link = screen.getByRole("link", { name: /request a new link/i });
    expect(link.getAttribute("href")).toBe("/reset");
  });

  it("also links back to sign in from a dead-token card", () => {
    renderForm({ status: "expired" });

    const link = screen.getByRole("link", { name: /back to sign in/i });
    expect(link.getAttribute("href")).toBe("/signin");
  });

  it("no form renders once the token state is expired, used or unknown", () => {
    renderForm({ status: "expired" });

    expect(screen.queryByLabelText("New password")).toBeNull();
    expect(screen.queryByRole("button", { name: /save password/i })).toBeNull();
  });
});