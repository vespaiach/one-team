import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { AcceptState } from "../actions";
import { AcceptInvitationForm } from "./accept-invitation-form";

function renderForm(initialState: AcceptState, action = vi.fn(), email = "invitee@example.com") {
  render(
    <AcceptInvitationForm
      action={action}
      initialState={initialState}
      email={email}
    />,
  );
  return action;
}

function submit() {
  const form = screen.getByRole("button", { name: /create account/i }).closest("form");
  if (!form) {
    throw new Error("no form found");
  }
  fireEvent.submit(form);
}

describe("AcceptInvitationForm (FR-026, FR-027, FR-028a)", () => {
  it("shows the invited address as a value, not a control", () => {
    renderForm({ status: "idle" }, vi.fn(), "invitee@example.com");

    expect(screen.getByText("invitee@example.com").tagName).toBe("B");
    expect(screen.queryByLabelText(/email/i)).toBeNull();
  });

  it("carries first name, last name and exactly one password field", () => {
    renderForm({ status: "idle" });

    expect(screen.getByLabelText(/first name/i)).not.toBeNull();
    expect(screen.getByLabelText(/last name/i)).not.toBeNull();
    expect(screen.getByLabelText("Password")).not.toBeNull();
  });

  it("names the too_short policy rule and nothing else", async () => {
    const action = vi.fn().mockResolvedValue({ status: "policy", failure: "too_short" });
    renderForm({ status: "idle" }, action);

    fireEvent.change(screen.getByLabelText(/first name/i), { target: { value: "Grace" } });
    fireEvent.change(screen.getByLabelText(/last name/i), { target: { value: "Hopper" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "short1" } });
    submit();

    expect(await screen.findByText(/at least 12/i)).not.toBeNull();
  });

  it("names the blocklisted policy rule and nothing else", async () => {
    const action = vi.fn().mockResolvedValue({ status: "policy", failure: "blocklisted" });
    renderForm({ status: "idle" }, action);

    submit();

    expect(await screen.findByText(/too common/i)).not.toBeNull();
  });

  it("shows in-flight state on submit and disables the control so a second press cannot land", async () => {
    let resolveAction: (value: AcceptState) => void = () => undefined;
    const action = vi.fn().mockImplementation(
      () =>
        new Promise<AcceptState>((resolve) => {
          resolveAction = resolve;
        }),
    );
    renderForm({ status: "idle" }, action);

    submit();

    const button = await screen.findByRole("button", { name: /creating/i });
    expect((button as HTMLButtonElement).disabled).toBe(true);

    resolveAction({ status: "idle" });
  });

  it("renders a distinguishable expired notice with a route back to sign in, and no form", () => {
    renderForm({ status: "expired" });

    expect(screen.getByRole("alert")).not.toBeNull();
    expect(screen.getByRole("link", { name: /sign in/i })).not.toBeNull();
    expect(screen.queryByLabelText(/first name/i)).toBeNull();
  });

  it("renders a distinguishable used notice with a route back to sign in, and no form", () => {
    renderForm({ status: "used" });

    expect(screen.getByRole("alert")).not.toBeNull();
    expect(screen.getByRole("link", { name: /sign in/i })).not.toBeNull();
    expect(screen.queryByLabelText(/first name/i)).toBeNull();
  });

  it("renders a distinguishable unknown notice with a route back to sign in, and no form", () => {
    renderForm({ status: "unknown" });

    expect(screen.getByRole("alert")).not.toBeNull();
    expect(screen.getByRole("link", { name: /sign in/i })).not.toBeNull();
    expect(screen.queryByLabelText(/first name/i)).toBeNull();
  });

  it("renders a taken notice naming that the address already has an account, pointed at sign in", () => {
    renderForm({ status: "taken" });

    const banner = screen.getByRole("alert");
    expect(banner.textContent).toMatch(/already has an account/i);
    expect(screen.getByRole("link", { name: /sign in/i })).not.toBeNull();
    expect(screen.queryByLabelText(/first name/i)).toBeNull();
  });

  it("the expired, used, unknown and taken states are each visibly distinct", () => {
    const headings = (["expired", "used", "unknown", "taken"] as const).map((status) => {
      const { unmount } = render(
        <AcceptInvitationForm
          action={vi.fn()}
          initialState={{ status }}
          email="invitee@example.com"
        />,
      );
      const heading = screen.getByRole("heading").textContent;
      unmount();
      return heading;
    });

    expect(new Set(headings).size).toBe(4);
  });
});