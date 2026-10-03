import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Button } from "../ui/hairline/index.ts";
import { ToastProvider } from "../ui/Toast.tsx";
import { AppShell } from "./AppShell.tsx";

vi.mock("next/navigation", () => ({
  usePathname: () => "/my-issues",
}));

const focusable = "a[href], button, input, select, textarea, summary, iframe, [tabindex], [contenteditable]";
const longName = "Alexandria Catherine Montgomery-Fitzwilliam van der Bergholt";

function renderShell(fullName = "Owner Name") {
  render(
    <ToastProvider>
      <AppShell member={{ fullName }}>content</AppShell>
    </ToastProvider>,
  );
  return within(screen.getByRole("navigation"));
}

function expectNotFocusable(element: HTMLElement) {
  expect(element.matches(focusable)).toBe(false);
  expect(element.querySelectorAll(focusable)).toHaveLength(0);
  expect(element.closest(focusable)).toBeNull();
}

const failedToast = "Couldn't save. Try again.";

function deferred() {
  let resolve: (response: Response) => void = () => {};
  const promise = new Promise<Response>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function answer(status: number) {
  return status === 204
    ? new Response(null, { status })
    : new Response(JSON.stringify({ error: { message: "Something went wrong." } }), {
        status,
        headers: { "Content-Type": "application/json" },
      });
}

function stubLocation() {
  const location = {
    href: "http://localhost:3000/my-issues",
    assign: vi.fn(),
    reload: vi.fn(),
  };
  vi.stubGlobal("location", location);
  return location;
}

function isDisabled(button: HTMLButtonElement) {
  return button.disabled || button.getAttribute("aria-disabled") === "true";
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function clickSignOut(button: HTMLButtonElement) {
  button.focus();
  fireEvent.click(button);
  await flush();
}

function signOutButton() {
  return renderShell().getByRole("button", { name: "Sign out" }) as HTMLButtonElement;
}

describe("AppShell", () => {
  it("shows the product name as plain text in the navigation region", () => {
    const navigation = renderShell();
    const name = navigation.getByText("Tracklite");
    expect(name.closest("a")).toBeNull();
  });

  it("has no project list element", () => {
    renderShell();
    const navigation = screen.getByRole("navigation");
    expect(navigation.querySelector("ul, ol, [role='list']")).toBeNull();
    expect(within(navigation).queryByRole("list")).toBeNull();
  });

  it("has a My issues link to /my-issues in the navigation region", () => {
    const navigation = renderShell();
    expect(navigation.getByRole("link", { name: "My issues" }).getAttribute("href")).toBe("/my-issues");
  });

  it("shows the signed-in member's initials avatar and full name in the navigation region", () => {
    const navigation = renderShell("Owner Name");
    expect(navigation.getByText("ON")).toBeTruthy();
    expect(navigation.getByText("Owner Name")).toBeTruthy();
  });

  it("places the member display after the My issues link, at the bottom of the sidebar", () => {
    const navigation = renderShell("Owner Name");
    const link = navigation.getByRole("link", { name: "My issues" });
    const name = navigation.getByText("Owner Name");
    expect(link.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("cuts off a 60-character name and keeps it whole for hover and screen readers", () => {
    expect(longName).toHaveLength(60);
    const navigation = renderShell(longName);
    expect(navigation.getByText("AB")).toBeTruthy();
    const name = navigation.getByText(longName);
    expect(name.classList.contains("truncate")).toBe(true);
    expect(name.getAttribute("title")).toBe(longName);
    expect(name.textContent).toBe(longName);
    expect(name.closest("[aria-hidden='true']")).toBeNull();
  });

  it("does not make the avatar or the name focusable", () => {
    const navigation = renderShell("Owner Name");
    expectNotFocusable(navigation.getByText("ON"));
    expectNotFocusable(navigation.getByText("Owner Name"));
  });

  it("renders its children in the main region", () => {
    render(
      <AppShell member={{ fullName: "Owner Name" }}>
        <p>Page content</p>
      </AppShell>,
    );
    const main = screen.getByRole("main");
    expect(within(main).getByText("Page content")).toBeTruthy();
    expect(within(screen.getByRole("navigation")).queryByText("Page content")).toBeNull();
  });

  describe("Sign out", () => {
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("is a tertiary Hairline Button in the navigation region", () => {
      const { container, unmount } = render(<Button variant="tertiary">Reference</Button>);
      const reference = container.querySelector("button")?.className;
      unmount();
      const button = signOutButton();
      expect(reference).toBeTruthy();
      expect(button.className).toBe(reference);
    });

    it("comes after the My issues link in Tab order", () => {
      const navigation = renderShell();
      const link = navigation.getByRole("link", { name: "My issues" });
      const button = navigation.getByRole("button", { name: "Sign out" }) as HTMLButtonElement;
      expect(link.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(button.matches(focusable)).toBe(true);
      expect(isDisabled(button)).toBe(false);
      expect(button.getAttribute("tabindex")).not.toBe("-1");
      const between = Array.from(document.body.querySelectorAll<HTMLElement>("*")).filter(
        (element) =>
          link.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING &&
          element.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING,
      );
      for (const element of between) {
        expect(element.tabIndex > 0).toBe(false);
      }
      expect(link.tabIndex > 0).toBe(false);
      expect(button.tabIndex > 0).toBe(false);
    });

    it("sends DELETE /api/sessions/current and then goes to /sign-in", async () => {
      const location = stubLocation();
      const fetchMock = vi.fn(async () => answer(204));
      vi.stubGlobal("fetch", fetchMock);
      const button = signOutButton();

      await clickSignOut(button);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
      expect(url).toBe("/api/sessions/current");
      expect(init.method).toBe("DELETE");
      expect(location.assign).toHaveBeenCalledTimes(1);
      expect(location.assign).toHaveBeenCalledWith("/sign-in");
      expect(location.reload).not.toHaveBeenCalled();
      expect(screen.queryByText(failedToast)).toBeNull();
    });

    it("is disabled while the request is in flight (3r Shell saving)", async () => {
      stubLocation();
      const pending = deferred();
      const fetchMock = vi.fn(() => pending.promise);
      vi.stubGlobal("fetch", fetchMock);
      const button = signOutButton();
      expect(isDisabled(button)).toBe(false);

      await clickSignOut(button);

      expect(isDisabled(button)).toBe(true);
      fireEvent.click(button);
      await flush();
      expect(fetchMock).toHaveBeenCalledTimes(1);

      await act(async () => {
        pending.resolve(answer(204));
        await Promise.resolve();
      });
    });

    const failures: [string, () => Promise<Response>][] = [
      ["a 500 answer", async () => answer(500)],
      [
        "a rejected fetch",
        async () => {
          throw new TypeError("Failed to fetch");
        },
      ],
    ];

    it.each(failures)(
      "shows the toast and is enabled again with focus on it for %s (3s Shell failed)",
      async (_name, respond) => {
        const location = stubLocation();
        vi.stubGlobal("fetch", vi.fn(respond));
        const button = signOutButton();

        await clickSignOut(button);
        await flush();

        const toast = screen.getByText(failedToast);
        expect(toast.closest('[aria-live="polite"]')).not.toBeNull();
        expect(location.assign).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "Sign out" })).toBe(button);
        expect(isDisabled(button)).toBe(false);
        expect(document.activeElement).toBe(button);
      },
    );
  });
});