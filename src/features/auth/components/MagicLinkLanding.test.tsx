import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignOutButton } from "../../../components/layout/SignOutButton.tsx";
import { ToastProvider } from "../../../components/ui/Toast.tsx";
import { saveJson } from "../../../lib/save.ts";
import { MagicLinkLanding } from "./MagicLinkLanding.tsx";

vi.mock("../../../lib/save.ts", () => ({
  saveJson: vi.fn(),
}));

vi.mock("../../../components/layout/SignOutButton.tsx", () => ({
  SignOutButton: vi.fn(() => <button type="button">Sign out</button>),
}));

type Initial = { state: "signIn" } | { state: "signedInAsOther"; fullName: string };
type Answer = Awaited<ReturnType<typeof saveJson>>;

const save = vi.mocked(saveJson);
const signOutButton = vi.mocked(SignOutButton);
const token = "k7Qm2xLp9sVb4nRt8wYz3cJd6fHg1aUe5iOo0pNq";
const failed = "Couldn't save. Try again.";
const expiredText = "This link has expired";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const focusable = "a[href], button, input, select, textarea, summary, iframe, [tabindex], [contenteditable]";

function otherMessage(fullName: string) {
  return `You're signed in as ${fullName}. Sign out to use this sign-in link.`;
}

function renderLanding(initial: Initial = { state: "signIn" }, linkToken = token) {
  return render(
    <ToastProvider>
      <MagicLinkLanding
        token={linkToken}
        initial={initial}
      />
    </ToastProvider>,
  );
}

function signInButton() {
  return screen.getByRole("button", { name: "Sign in" }) as HTMLButtonElement;
}

async function click(button: HTMLElement) {
  button.focus();
  await act(async () => {
    fireEvent.click(button);
  });
}

function sentBody(call: number) {
  const [url, body] = save.mock.calls[call] as [string, { token: string; requestId: string }];
  expect(url).toBe("/api/sessions");
  return body;
}

function expectNextTab(from: HTMLElement, to: HTMLElement) {
  expect(from.compareDocumentPosition(to) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  expect(to.matches(":disabled")).toBe(false);
  expect(to.tabIndex).toBeGreaterThanOrEqual(0);
  const between = Array.from(document.body.querySelectorAll<HTMLElement>("*")).filter(
    (element) =>
      element !== from &&
      element !== to &&
      from.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING &&
      element.compareDocumentPosition(to) & Node.DOCUMENT_POSITION_FOLLOWING,
  );
  expect(between.filter((element) => element.tabIndex > 0)).toHaveLength(0);
  expect(
    between.filter(
      (element) => element.matches(focusable) && element.tabIndex >= 0 && !element.matches(":disabled"),
    ),
  ).toHaveLength(0);
}

function expectNotTruncated(element: HTMLElement) {
  for (let current: HTMLElement | null = element; current; current = current.parentElement) {
    expect(current.classList.contains("truncate")).toBe(false);
    expect(current.classList.contains("text-ellipsis")).toBe(false);
    expect(current.classList.contains("line-clamp-1")).toBe(false);
    expect(current.classList.contains("whitespace-nowrap")).toBe(false);
  }
}

describe("MagicLinkLanding", () => {
  beforeEach(() => {
    save.mockReset();
    signOutButton.mockClear();
    vi.stubGlobal("location", { href: "http://localhost:3000/sign-in", assign: vi.fn(), reload: vi.fn() });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    ["a token", token],
    ["an empty token", ""],
  ])("3j Populated: heading and a primary Sign in button for %s", (_label, linkToken) => {
    renderLanding({ state: "signIn" }, linkToken);

    expect(screen.getByRole("heading", { name: "Sign in to Tracklite" })).toBeTruthy();
    const button = signInButton();
    expect(button.disabled).toBe(false);
    expect(button.classList.contains("bg-primary")).toBe(true);
    expect(screen.queryByRole("button", { name: "Sign out" })).toBeNull();
    expect(screen.queryByText(expiredText)).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it("3n Saving: Sign in is disabled after the click until the answer", async () => {
    let answer: (value: Answer) => void = () => {};
    save.mockReturnValue(
      new Promise((resolve) => {
        answer = resolve;
      }),
    );
    renderLanding();
    const button = signInButton();

    await click(button);

    expect(button.disabled).toBe(true);
    expect(save).toHaveBeenCalledTimes(1);
    const body = sentBody(0);
    expect(body.token).toBe(token);
    expect(body.requestId).toMatch(uuidPattern);

    await act(async () => {
      answer({ ok: false, toast: failed });
    });

    expect(button.disabled).toBe(false);
  });

  it("sends an empty token as is", async () => {
    save.mockResolvedValue({ ok: true, data: { outcome: "expired" } });
    renderLanding({ state: "signIn" }, "");

    await click(signInButton());

    expect(sentBody(0).token).toBe("");
  });

  it("signedIn: goes to the destination", async () => {
    save.mockResolvedValue({ ok: true, data: { outcome: "signedIn", destination: "/project/WEB?tab=open" } });
    renderLanding();

    await click(signInButton());

    expect(window.location.assign).toHaveBeenCalledWith("/project/WEB?tab=open");
  });

  it("3k Link expired: focused heading, then Request a new link to /sign-in on the next Tab", async () => {
    save.mockResolvedValue({ ok: true, data: { outcome: "expired" } });
    renderLanding();

    await click(signInButton());

    const heading = await screen.findByRole("heading", { name: expiredText });
    expect(heading.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(heading);
    const link = screen.getByRole("link", { name: "Request a new link" });
    expect(link.getAttribute("href")).toBe("/sign-in");
    expectNextTab(heading, link);
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
    expect(screen.queryByText(failed)).toBeNull();
  });

  it("3l Another member: the initial state shows the message and Sign out instead of Sign in, focus left at the browser default", () => {
    renderLanding({ state: "signedInAsOther", fullName: "Alex Doe" });

    const message = screen.getByRole("heading", { name: otherMessage("Alex Doe") });
    expect(message.textContent).toBe(otherMessage("Alex Doe"));
    const signOut = screen.getByRole("button", { name: "Sign out" });
    expectNextTab(message, signOut);
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  it("3aa/3ab: the Sign out button is SignOutButton, secondary, reloading the same page", () => {
    renderLanding({ state: "signedInAsOther", fullName: "Alex Doe" });

    expect(signOutButton).toHaveBeenCalled();
    expect(signOutButton.mock.calls.at(-1)?.[0]).toMatchObject({ variant: "secondary", after: "reload" });
  });

  it("3l Another member: a Sign in answered signedInAsOther switches to that state with focus on the message and no toast", async () => {
    save.mockResolvedValue({ ok: true, data: { outcome: "signedInAsOther", fullName: "Alex Doe" } });
    renderLanding();

    await click(signInButton());

    const message = await screen.findByRole("heading", { name: otherMessage("Alex Doe") });
    expect(message.getAttribute("tabindex")).toBe("-1");
    expect(document.activeElement).toBe(message);
    const signOut = screen.getByRole("button", { name: "Sign out" });
    expectNextTab(message, signOut);
    expect(signOutButton.mock.calls.at(-1)?.[0]).toMatchObject({ variant: "secondary", after: "reload" });
    expect(screen.queryByRole("button", { name: "Sign in" })).toBeNull();
    expect(screen.queryByText(failed)).toBeNull();
    expect(document.querySelector("[aria-live]")?.textContent).toBe("");
    expect(window.location.assign).not.toHaveBeenCalled();
  });

  it("3m Another member long name: a 60-character full name is shown whole", () => {
    const fullName = `Maximiliana ${"Q".repeat(35)} Featherstone`;
    expect(fullName).toHaveLength(60);
    renderLanding({ state: "signedInAsOther", fullName });

    const message = screen.getByRole("heading", { name: otherMessage(fullName) });
    expect(message.textContent).toBe(otherMessage(fullName));
    expectNotTruncated(message);
  });

  it("3o Landing failed: toast, Sign in enabled again with focus on it, and a retry sends the same requestId and token", async () => {
    save.mockResolvedValue({ ok: false, toast: failed });
    renderLanding();
    const button = signInButton();

    await click(button);

    expect(await screen.findByText(failed)).toBeTruthy();
    expect(button.disabled).toBe(false);
    expect(document.activeElement).toBe(button);
    expect(window.location.assign).not.toHaveBeenCalled();

    await click(button);

    expect(save).toHaveBeenCalledTimes(2);
    const first = sentBody(0);
    const second = sentBody(1);
    expect(first.requestId).toMatch(uuidPattern);
    expect(second).toEqual({ token, requestId: first.requestId });
  });

  it("a fresh mount uses a different requestId", async () => {
    save.mockResolvedValue({ ok: false, toast: failed });
    const first = renderLanding();
    await click(signInButton());
    first.unmount();

    renderLanding();
    await click(signInButton());

    expect(save).toHaveBeenCalledTimes(2);
    expect(sentBody(0).requestId).toMatch(uuidPattern);
    expect(sentBody(1).requestId).toMatch(uuidPattern);
    expect(sentBody(1).requestId).not.toBe(sentBody(0).requestId);
  });
});