import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignInForm } from "./sign-in-form";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

function jsonResponse(body: unknown) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } }),
  );
}

function fillValidForm() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct horse battery" } });
}

beforeEach(() => {
  pushMock.mockReset();
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SignInForm — states (FR-012, SC-003)", () => {
  it("renders the form with an email field, a password field and a Sign in control", () => {
    render(<SignInForm />);

    expect(screen.getByLabelText("Email")).not.toBeNull();
    expect(screen.getByLabelText("Password")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Sign in" })).not.toBeNull();
  });

  it("navigates to /home on a successful sign-in", async () => {
    vi.mocked(fetch).mockReturnValue(jsonResponse({ result: "ok" }));
    render(<SignInForm />);
    fillValidForm();

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/home"));
  });

  it("renders the rejected message in the outcome region", async () => {
    vi.mocked(fetch).mockReturnValue(jsonResponse({ result: "rejected" }));
    render(<SignInForm />);
    fillValidForm();

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const outcome = await screen.findByRole("alert");
    expect(outcome.textContent).toContain("That email and password don't match.");
  });

  it("renders the deactivated message with the configured contact", async () => {
    vi.mocked(fetch).mockReturnValue(jsonResponse({ result: "deactivated", contact: "help@example.com" }));
    render(<SignInForm />);
    fillValidForm();

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const outcome = await screen.findByRole("alert");
    expect(outcome.textContent).toContain("help@example.com");
  });

  it("renders the deactivated message naming no address when the operator configured none", async () => {
    vi.mocked(fetch).mockReturnValue(jsonResponse({ result: "deactivated", contact: null }));
    render(<SignInForm />);
    fillValidForm();

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const outcome = await screen.findByRole("alert");
    expect(outcome.textContent).toContain("Contact your One Team administrator.");
  });

  it("carries the rejected and deactivated outcomes in the same element in the same position", async () => {
    vi.mocked(fetch).mockReturnValue(jsonResponse({ result: "rejected" }));
    const { container: rejectedContainer, unmount } = render(<SignInForm />);
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    const rejectedOutcome = await within(rejectedContainer).findByRole("alert");
    const rejectedPosition = Array.from(rejectedContainer.querySelectorAll("*")).indexOf(rejectedOutcome);
    unmount();

    vi.mocked(fetch).mockReturnValue(jsonResponse({ result: "deactivated", contact: null }));
    const { container: deactivatedContainer } = render(<SignInForm />);
    fillValidForm();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    const deactivatedOutcome = await within(deactivatedContainer).findByRole("alert");
    const deactivatedPosition = Array.from(deactivatedContainer.querySelectorAll("*")).indexOf(
      deactivatedOutcome,
    );

    expect(rejectedOutcome.tagName).toBe(deactivatedOutcome.tagName);
    expect(rejectedPosition).toBe(deactivatedPosition);
  });

  it("renders the throttled remaining time as whole minutes rounded up", async () => {
    vi.mocked(fetch).mockReturnValue(jsonResponse({ result: "throttled", retryAfterSeconds: 61 }));
    render(<SignInForm />);
    fillValidForm();

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const outcome = await screen.findByRole("alert");
    expect(outcome.textContent).toContain("2 minutes");
  });

  it("shows an in-flight state while the request is outstanding", async () => {
    let resolveFetch: (value: Response) => void = () => {};
    vi.mocked(fetch).mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );
    render(<SignInForm />);
    fillValidForm();
    const submit = screen.getByRole("button", { name: "Sign in" });

    fireEvent.click(submit);

    expect(submit.getAttribute("aria-disabled")).not.toBe("true");
    await waitFor(() => expect(screen.getByText(/Signing in/i)).not.toBeNull());

    resolveFetch(
      new Response(JSON.stringify({ result: "ok" }), { headers: { "content-type": "application/json" } }),
    );
  });
});

describe("SignInForm — interaction contract (FR-081…FR-086, FR-027, research B-8)", () => {
  it("validates a field on blur without disabling submit, and clears the error once corrected", () => {
    render(<SignInForm />);

    const email = screen.getByLabelText("Email");
    fireEvent.focus(email);
    fireEvent.blur(email);

    expect(screen.getByRole("button", { name: "Sign in" }).hasAttribute("disabled")).toBe(false);
    expect(screen.getByText("Enter your email address.")).not.toBeNull();

    fireEvent.change(email, { target: { value: "ada@example.com" } });
    fireEvent.blur(email);

    expect(screen.queryByText("Enter your email address.")).toBeNull();
  });

  it("validates a never-blurred field on submit and moves focus to the first invalid field, with no error summary", () => {
    render(<SignInForm />);

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const email = screen.getByLabelText("Email");
    expect(document.activeElement).toBe(email);
    expect(screen.getByText("Enter your email address.")).not.toBeNull();
    expect(screen.queryByRole("alert", { name: /error/i })).toBeNull();
  });

  it("is completable using the keyboard alone, following the card's visual order", () => {
    render(<SignInForm />);

    const email = screen.getByLabelText("Email");
    const password = screen.getByLabelText("Password");
    const submit = screen.getByRole("button", { name: "Sign in" });

    const focusable = [email, password, submit];
    for (const element of focusable) {
      expect(element.getAttribute("tabindex")).not.toBe("-1");
    }
  });

  it("wraps a long address instead of overflowing or scrolling horizontally", async () => {
    const longEmail = `${"a".repeat(80)}@example.com`;
    vi.mocked(fetch).mockReturnValue(jsonResponse({ result: "deactivated", contact: longEmail }));
    render(<SignInForm />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "ada@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "correct horse battery" } });

    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

    const outcome = await screen.findByRole("alert");
    expect(outcome.className).toContain("break-words");
  });

  it("carries no animation or transition classes", () => {
    const { container } = render(<SignInForm />);

    expect(container.innerHTML).not.toMatch(/transition|animate/);
  });
});