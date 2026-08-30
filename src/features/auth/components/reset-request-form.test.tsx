import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  it("renders an email field and a Send reset link control, and nothing else", () => {
    render(<ResetRequestForm />);

    expect(screen.getByLabelText(/email/i)).not.toBeNull();
    expect(screen.getByRole("button", { name: /send reset link/i })).not.toBeNull();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.queryByLabelText(/password/i)).toBeNull();
  });

  it("shows the identical confirmation whether or not the address has an account", async () => {
    vi.mocked(requestPasswordReset).mockResolvedValue({ status: "sent" });

    render(<ResetRequestForm />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "ada@example.com" } });
    submit();

    expect(await screen.findByText("If that address has an account, a link is on the way")).not.toBeNull();
    expect(screen.queryByLabelText(/email/i)).toBeNull();
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

    expect(await screen.findByText("If that address has an account, a link is on the way")).not.toBeNull();
  });
});