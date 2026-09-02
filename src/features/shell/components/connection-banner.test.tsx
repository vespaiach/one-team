import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CHANGES_NEED_A_CONNECTION,
  ConnectionBanner,
  guardedWrite,
  reportTransportFailure,
  reportTransportSuccess,
} from "./connection-banner";

beforeEach(() => {
  reportTransportSuccess();
});

afterEach(() => {
  reportTransportSuccess();
});

describe("ConnectionBanner (FR-057, R2 FR-035)", () => {
  it("renders nothing while the connection is live", () => {
    render(<ConnectionBanner />);

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("reads exactly the banner text once a transport failure is reported", () => {
    render(<ConnectionBanner />);

    act(() => {
      reportTransportFailure();
    });

    expect(screen.getByRole("alert").textContent).toBe("Can't reach the server. Reconnecting.");
  });

  it("clears on the next request that reaches the server", () => {
    render(<ConnectionBanner />);
    act(() => {
      reportTransportFailure();
    });
    expect(screen.getByRole("alert")).not.toBeNull();

    act(() => {
      reportTransportSuccess();
    });

    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("guardedWrite (FR-057, R2 FR-035)", () => {
  it("refuses a write while offline with 'Changes need a connection', never calling the underlying action", async () => {
    reportTransportFailure();
    let called = false;
    const perform = async () => {
      called = true;
      return "should not run";
    };

    const outcome = await guardedWrite(perform);

    expect(outcome).toEqual({ performed: false, reason: CHANGES_NEED_A_CONNECTION });
    expect(called).toBe(false);
  });

  it("queues nothing for later — a refused write is not retried once the connection returns", async () => {
    reportTransportFailure();
    let calls = 0;
    const perform = async () => {
      calls += 1;
      return "ok";
    };

    await guardedWrite(perform);
    reportTransportSuccess();
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(calls).toBe(0);
  });

  it("performs the write when online and returns its result", async () => {
    const outcome = await guardedWrite(async () => "the-result");

    expect(outcome).toEqual({ performed: true, result: "the-result" });
  });

  it("reports a transport failure, not a server refusal, when the call itself rejects", async () => {
    render(<ConnectionBanner />);

    await expect(
      guardedWrite(async () => {
        throw new Error("network down");
      }),
    ).rejects.toThrow("network down");

    expect(screen.getByRole("alert")).not.toBeNull();
  });

  it("never shows the banner for a refusal the server itself returned normally", async () => {
    render(<ConnectionBanner />);

    const outcome = await guardedWrite(async () => ({ status: "forbidden" as const }));

    expect(outcome).toEqual({ performed: true, result: { status: "forbidden" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });
});