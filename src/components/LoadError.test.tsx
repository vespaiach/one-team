import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useLoad } from "../lib/load.ts";
import { LoadError } from "./LoadError.tsx";
import { Loading } from "./Loading.tsx";

function Host() {
  const { state, data, retry } = useLoad("/api/thing");
  if (state === "loading") return <Loading />;
  if (state === "error") return <LoadError onRetry={retry} />;
  return <p>Content {JSON.stringify(data)}</p>;
}

function deferred() {
  let resolve: (response: Response) => void = () => {};
  let reject: (error: Error) => void = () => {};
  const promise = new Promise<Response>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe("LoadError with useLoad", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("never shows the loading indicator when the load settles within 300 ms", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            setTimeout(() => resolve(json(200, { name: "Alpha" })), 200);
          }),
      ),
    );
    render(<Host />);
    expect(screen.queryByRole("status")).toBeNull();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText(/Content/).textContent).toContain("Alpha");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it.each([404, 500])("shows the load error and Retry for a %i answer", async (status) => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(status, { error: { message: "Nope" } })),
    );
    render(<Host />);
    await flush();
    expect(screen.getByText("Couldn't load this.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(screen.queryByText(/Content/)).toBeNull();
  });

  it("shows the load error and Retry for a rejected fetch", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    render(<Host />);
    await flush();
    expect(screen.getByText("Couldn't load this.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("keeps Retry mounted with no loading indicator while retrying, keeps focus on Retry after a second failure and shows the content after a successful retry", async () => {
    const second = deferred();
    const third = deferred();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json(500, { error: { message: "Something went wrong." } }))
      .mockReturnValueOnce(second.promise)
      .mockReturnValueOnce(third.promise);
    vi.stubGlobal("fetch", fetchMock);
    render(<Host />);
    await flush();

    const retry = screen.getByRole("button", { name: "Retry" });
    retry.focus();
    fireEvent.click(retry);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByRole("button", { name: "Retry" })).toBe(retry);
    expect(screen.getByText("Couldn't load this.")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();

    await act(async () => {
      second.reject(new TypeError("Failed to fetch"));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByRole("button", { name: "Retry" })).toBe(retry);
    expect(document.activeElement).toBe(retry);

    fireEvent.click(retry);
    await flush();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("button", { name: "Retry" })).toBe(retry);
    expect(screen.queryByRole("status")).toBeNull();

    await act(async () => {
      third.resolve(json(200, { name: "Alpha" }));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByText(/Content/).textContent).toContain("Alpha");
    expect(screen.queryByText("Couldn't load this.")).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
  });
});