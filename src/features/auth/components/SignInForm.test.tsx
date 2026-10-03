import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ToastProvider } from "../../../components/ui/Toast.tsx";
import { sendSignInLinkRequest } from "../services/sendSignInLinkRequest.ts";
import { SignInForm } from "./SignInForm.tsx";

vi.mock("../services/sendSignInLinkRequest.ts", () => ({
  sendSignInLinkRequest: vi.fn(),
}));

const send = vi.mocked(sendSignInLinkRequest);
const next = "/project/WEB?tab=open";
const email = "sam@acme.com";
const invalid = "Enter a valid email address.";
const failed = "Couldn't save. Try again.";
const limit = "Too many sign-in requests. Try again later.";
const sendFailed = "We couldn't send the email. Try again.";

function renderForm() {
  render(
    <ToastProvider>
      <SignInForm next={next} />
    </ToastProvider>,
  );
  return {
    field: screen.getByLabelText("Email") as HTMLInputElement,
    button: screen.getByRole("button", { name: "Send sign-in link" }) as HTMLButtonElement,
  };
}

function type(field: HTMLInputElement, value: string) {
  fireEvent.change(field, { target: { value } });
}

async function submit(field: HTMLInputElement) {
  const form = field.closest("form") as HTMLFormElement;
  await act(async () => {
    fireEvent.submit(form);
  });
}

async function click(button: HTMLButtonElement) {
  button.focus();
  await act(async () => {
    fireEvent.click(button);
  });
}

describe("SignInForm", () => {
  beforeEach(() => {
    send.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("3a Populated: heading, an empty focused email field and the send button", () => {
    const { field, button } = renderForm();

    expect(screen.getByRole("heading", { name: "Sign in to Tracklite" })).toBeTruthy();
    expect(field.type).toBe("email");
    expect(field.value).toBe("");
    expect(document.activeElement).toBe(field);
    expect(button.disabled).toBe(false);
  });

  it("Enter submits: the field and the button share one form, and submitting it sends the request", async () => {
    send.mockResolvedValue({ kind: "checkEmail" });
    const { field, button } = renderForm();
    const form = field.closest("form");
    expect(form).not.toBeNull();
    expect(button.closest("form")).toBe(form);
    type(field, email);

    await submit(field);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0]?.[0]).toMatchObject({ email, next });
  });

  it("sends a new crypto.randomUUID() requestId and the next prop with each submission", async () => {
    const ids = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"] as const;
    const uuid = vi.spyOn(crypto, "randomUUID");
    uuid.mockReturnValueOnce(ids[0]).mockReturnValueOnce(ids[1]);
    send.mockResolvedValueOnce({ kind: "failed" }).mockResolvedValueOnce({ kind: "checkEmail" });
    const { field } = renderForm();
    type(field, email);

    await submit(field);
    await submit(field);

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]?.[0]).toEqual({ email, requestId: ids[0], next });
    expect(send.mock.calls[1]?.[0]).toEqual({ email, requestId: ids[1], next });
  });

  it("3e Saving: the send button is disabled while the request is in flight", async () => {
    let answer: (value: Awaited<ReturnType<typeof sendSignInLinkRequest>>) => void = () => {};
    send.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    const { field, button } = renderForm();
    type(field, email);

    await submit(field);

    expect(button.disabled).toBe(true);

    await act(async () => {
      answer({ kind: "failed" });
    });

    expect(button.disabled).toBe(false);
  });

  it("3b Check your email: a focused heading replaces the form and the email appears nowhere", async () => {
    send.mockResolvedValue({ kind: "checkEmail" });
    const { field } = renderForm();
    type(field, email);

    await submit(field);

    const message = await screen.findByRole("heading", { name: "Check your email" });
    expect(message.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(message);
    expect(screen.queryByLabelText("Email")).toBeNull();
    expect(screen.queryByRole("button", { name: "Send sign-in link" })).toBeNull();
    expect(document.querySelector("form")).toBeNull();
    expect(document.body.textContent).not.toContain(email);
    for (const input of Array.from(document.querySelectorAll("input"))) {
      expect(input.value).not.toContain(email);
    }
  });

  it("3d Field error: the message sits under the field, linked to it, with the text kept and focus on the field", async () => {
    send.mockResolvedValue({ kind: "fields", fields: { email: invalid } });
    const { field, button } = renderForm();
    type(field, "nope");

    await click(button);

    const error = await screen.findByText(invalid);
    expect(field.getAttribute("aria-invalid")).toBe("true");
    const describedBy = field.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(describedBy?.split(" ")).toContain(error.id);
    expect(field.compareDocumentPosition(error) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(field.value).toBe("nope");
    expect(document.activeElement).toBe(field);
  });

  it("3g Couldn't save: toast, the email kept, the send button enabled again and focused", async () => {
    send.mockResolvedValue({ kind: "failed" });
    const { field, button } = renderForm();
    type(field, email);

    await submit(field);

    expect(await screen.findByText(failed)).toBeTruthy();
    expect(field.value).toBe(email);
    expect(button.disabled).toBe(false);
    expect(document.activeElement).toBe(button);
  });

  it("3h Long email: a 254-character email stays in the field after a failure", async () => {
    send.mockResolvedValue({ kind: "failed" });
    const long = `${"a".repeat(64)}@${"b".repeat(63)}.${"c".repeat(63)}.${"d".repeat(61)}`;
    expect(long).toHaveLength(254);
    const { field } = renderForm();
    type(field, long);

    await submit(field);

    expect(await screen.findByText(failed)).toBeTruthy();
    expect(field.value).toBe(long);
  });
  it("3c Limit reached: an announced message under the form, the email kept and focus left on the enabled send button", async () => {
    send.mockResolvedValue({ kind: "limit" });
    const { field, button } = renderForm();
    type(field, email);

    await click(button);

    const message = await screen.findByText(limit);
    expect(message.closest('[role="status"]')).not.toBeNull();
    expect(button.compareDocumentPosition(message) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(field.value).toBe(email);
    expect(button.disabled).toBe(false);
    expect(document.activeElement).toBe(button);
  });

  it("3c Limit reached: the message goes away on the next submission", async () => {
    send.mockResolvedValueOnce({ kind: "limit" }).mockReturnValueOnce(new Promise(() => {}));
    const { field, button } = renderForm();
    type(field, email);

    await click(button);
    expect(await screen.findByText(limit)).toBeTruthy();

    await click(button);

    expect(send).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(limit)).toBeNull();
  });

  it("3f Send failed: toast, the email kept, the send button enabled again and focused", async () => {
    send.mockResolvedValue({ kind: "sendFailed" });
    const { field, button } = renderForm();
    type(field, email);

    await submit(field);

    expect(await screen.findByText(sendFailed)).toBeTruthy();
    expect(field.value).toBe(email);
    expect(button.disabled).toBe(false);
    expect(document.activeElement).toBe(button);
  });

  it("3f Send failed: submitting again after the toast sends a new requestId", async () => {
    const ids = ["33333333-3333-4333-8333-333333333333", "44444444-4444-4444-8444-444444444444"] as const;
    const uuid = vi.spyOn(crypto, "randomUUID");
    uuid.mockReturnValueOnce(ids[0]).mockReturnValueOnce(ids[1]);
    send.mockResolvedValueOnce({ kind: "sendFailed" }).mockResolvedValueOnce({ kind: "checkEmail" });
    const { field } = renderForm();
    type(field, email);

    await submit(field);
    expect(await screen.findByText(sendFailed)).toBeTruthy();
    await submit(field);

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[0]?.[0]).toEqual({ email, requestId: ids[0], next });
    expect(send.mock.calls[1]?.[0]).toEqual({ email, requestId: ids[1], next });
  });
});