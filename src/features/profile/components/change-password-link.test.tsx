import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requestOwnPasswordReset } from "@/features/auth/actions";
import { ChangePasswordLink } from "./change-password-link";

vi.mock("@/features/auth/actions", () => ({
  requestOwnPasswordReset: vi.fn(),
}));

const raiseMessageMock = vi.fn();
vi.mock("@/features/shell/messages", () => ({
  raiseMessage: (...args: unknown[]) => raiseMessageMock(...args),
}));

beforeEach(() => {
  vi.mocked(requestOwnPasswordReset).mockReset();
  raiseMessageMock.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ChangePasswordLink (FR-026, FR-027, FR-028, FR-029)", () => {
  it("asks for no address and shows no form", () => {
    render(<ChangePasswordLink />);

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByRole("form")).toBeNull();
    expect(screen.getByRole("button", { name: "Change password" })).not.toBeNull();
  });

  it("shows an in-flight state on itself and cannot be pressed a second time while the request is out", async () => {
    let resolveAction: (value: { status: "sent" }) => void = () => undefined;
    vi.mocked(requestOwnPasswordReset).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        }),
    );

    render(<ChangePasswordLink />);
    const button = screen.getByRole("button", { name: "Change password" });
    fireEvent.click(button);

    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(true));
    fireEvent.click(button);
    expect(requestOwnPasswordReset).toHaveBeenCalledTimes(1);

    resolveAction({ status: "sent" });
    await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
  });

  it("raises the verbatim confirmation message on success", async () => {
    vi.mocked(requestOwnPasswordReset).mockResolvedValue({ status: "sent" });

    render(<ChangePasswordLink />);
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));

    await waitFor(() =>
      expect(raiseMessageMock).toHaveBeenCalledWith(
        "success",
        "Check your email for a link to reset your password.",
      ),
    );
  });

  it("states the throttle refusal in whole minutes, rounded up", async () => {
    vi.mocked(requestOwnPasswordReset).mockResolvedValue({ status: "throttled", retryAfterSeconds: 130 });

    render(<ChangePasswordLink />);
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));

    await waitFor(() =>
      expect(raiseMessageMock).toHaveBeenCalledWith("error", "Too many requests. Try again in 3 minutes."),
    );
  });

  it("never states a wait below one minute", async () => {
    vi.mocked(requestOwnPasswordReset).mockResolvedValue({ status: "throttled", retryAfterSeconds: 5 });

    render(<ChangePasswordLink />);
    fireEvent.click(screen.getByRole("button", { name: "Change password" }));

    await waitFor(() =>
      expect(raiseMessageMock).toHaveBeenCalledWith("error", "Too many requests. Try again in 1 minute."),
    );
  });
});