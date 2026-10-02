import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Button } from "../ui/hairline/index.ts";
import { ToastProvider } from "../ui/Toast.tsx";
import { SignOutButton } from "./SignOutButton.tsx";

const failedToast = "Couldn't save. Try again.";

type Variant = "secondary" | "tertiary";
type After = "signIn" | "reload";

function deferred() {
  let resolve: (response: Response) => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<Response>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
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

function renderButton(variant: Variant, after: After) {
  render(
    <ToastProvider>
      <SignOutButton
        variant={variant}
        after={after}
      />
    </ToastProvider>,
  );
  return screen.getByRole("button", { name: "Sign out" }) as HTMLButtonElement;
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

const modes: [Variant, After][] = [
  ["tertiary", "signIn"],
  ["secondary", "reload"],
];

describe("SignOutButton", () => {
  let location: ReturnType<typeof stubLocation>;

  beforeEach(() => {
    location = stubLocation();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each<Variant>(["secondary", "tertiary"])("renders the Hairline %s Button", (variant) => {
    const { container } = render(<Button variant={variant}>Reference</Button>);
    const reference = container.querySelector("button")?.className;
    const button = renderButton(variant, "signIn");
    expect(reference).toBeTruthy();
    expect(button.className).toBe(reference);
  });

  it.each(modes)("sends DELETE /api/sessions/current (%s, %s)", async (variant, after) => {
    const fetchMock = vi.fn(async () => answer(204));
    vi.stubGlobal("fetch", fetchMock);
    const button = renderButton(variant, after);

    await clickSignOut(button);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/sessions/current");
    expect(init.method).toBe("DELETE");
  });

  it.each(modes)("is disabled while the request is in flight (%s, %s)", async (variant, after) => {
    const pending = deferred();
    const fetchMock = vi.fn(() => pending.promise);
    vi.stubGlobal("fetch", fetchMock);
    const button = renderButton(variant, after);
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

  it('goes to /sign-in on 204 in the "signIn" mode', async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => answer(204)),
    );
    const button = renderButton("tertiary", "signIn");

    await clickSignOut(button);

    expect(location.assign).toHaveBeenCalledTimes(1);
    expect(location.assign).toHaveBeenCalledWith("/sign-in");
    expect(location.reload).not.toHaveBeenCalled();
    expect(screen.queryByText(failedToast)).toBeNull();
  });

  it('reloads the page on 204 in the "reload" mode', async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => answer(204)),
    );
    const button = renderButton("secondary", "reload");

    await clickSignOut(button);

    expect(location.reload).toHaveBeenCalledTimes(1);
    expect(location.assign).not.toHaveBeenCalled();
    expect(screen.queryByText(failedToast)).toBeNull();
  });

  const failures: [string, () => Promise<Response>][] = [
    ["a 500 answer", async () => answer(500)],
    ["a 403 answer", async () => answer(403)],
    [
      "a rejected fetch",
      async () => {
        throw new TypeError("Failed to fetch");
      },
    ],
  ];

  describe.each(modes)("on failure (%s, %s)", (variant, after) => {
    it.each(failures)(
      "shows the toast, stays on the page and is enabled again with focus on it for %s",
      async (_name, respond) => {
        vi.stubGlobal("fetch", vi.fn(respond));
        const button = renderButton(variant, after);

        await clickSignOut(button);
        await flush();

        const toast = screen.getByText(failedToast);
        expect(toast.closest('[aria-live="polite"]')).not.toBeNull();
        expect(location.assign).not.toHaveBeenCalled();
        expect(location.reload).not.toHaveBeenCalled();
        expect(screen.getByRole("button", { name: "Sign out" })).toBe(button);
        expect(isDisabled(button)).toBe(false);
        expect(document.activeElement).toBe(button);
      },
    );
  });
});