import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestPasswordReset } from "../actions";
import { ResetRequestForm } from "./reset-request-form";

vi.mock("../actions", () => ({
  requestPasswordReset: vi.fn(),
}));

afterEach(() => {
  vi.clearAllMocks();
});

function submit() {
  const form = screen.getByRole("button", { name: /send reset link/i }).closest("form");
  if (!form) {
    throw new Error("no form found");
  }
  fireEvent.submit(form);
}

describe("ResetRequestForm (FR-030)", () => {
  it("renders the title, an email field, a Send reset link control and a single back-to-sign-in link", () => {
    render(<ResetRequestForm />);

    expect(screen.getByRole("heading", { name: "Reset your password" })).not.toBeNull();
    expect(screen.getByLabelText(/email/i)).not.toBeNull();
    expect(screen.getByRole("button", { name: /send reset link/i })).not.toBeNull();
    expect(screen.queryByLabelText(/password/i)).toBeNull();

    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(1);
    expect(links[0]?.textContent).toContain("Back to sign in");
    expect(links[0]?.getAttribute("href")).toBe("/signin");
  });

  it("shows the identical confirmation whether or not the address has an account", async () => {
    vi.mocked(requestPasswordReset).mockResolvedValue({ status: "sent" });

    render(<ResetRequestForm />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "ada@example.com" } });
    submit();

    expect(await screen.findByText("If that address has an account, a link is on the way.")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Check your email" })).not.toBeNull();
    expect(screen.queryByLabelText(/email/i)).toBeNull();
  });

  it("shows the same confirmation with a live countdown when already throttled", async () => {
    vi.mocked(requestPasswordReset).mockResolvedValue({ status: "throttled", retryAfterSeconds: 47 });

    render(<ResetRequestForm />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "ada@example.com" } });
    submit();

    expect(await screen.findByText("If that address has an account, a link is on the way.")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Check your email" })).not.toBeNull();
    expect(screen.getByText(/00:47/)).not.toBeNull();
  });

  it("shows an in-flight state while the action is pending, then the confirmation", async () => {
    let resolveAction: (value: { status: "sent" }) => void = () => undefined;
    vi.mocked(requestPasswordReset).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        }),
    );

    render(<ResetRequestForm />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "ada@example.com" } });
    submit();

    expect(await screen.findByRole("button", { name: /sending/i })).not.toBeNull();

    resolveAction({ status: "sent" });

    expect(await screen.findByText("If that address has an account, a link is on the way.")).not.toBeNull();
  });
});

describe("ResetRequestForm — resend cooldown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("disables request-another while the cooldown counts down, and enables it once it reaches zero", async () => {
    vi.mocked(requestPasswordReset).mockResolvedValue({ status: "throttled", retryAfterSeconds: 2 });

    render(<ResetRequestForm />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "ada@example.com" } });
    await vi.waitFor(() => submit());

    const requestAnother = await vi.waitFor(() => screen.getByRole("button", { name: /request another/i }));
    expect(requestAnother.hasAttribute("disabled")).toBe(true);

    await vi.advanceTimersByTimeAsync(2000);

    expect(requestAnother.hasAttribute("disabled")).toBe(false);
    expect(screen.queryByText(/00:00/)).toBeNull();
  });
});