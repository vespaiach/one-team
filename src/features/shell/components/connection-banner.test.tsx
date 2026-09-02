import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ConnectionBanner } from "./connection-banner";

const BANNER_TEXT = "You’re offline. Changes can’t be saved.";

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, value });
}

beforeEach(() => {
  setOnline(true);
});

afterEach(() => {
  setOnline(true);
});

describe("ConnectionBanner (FR-034, OT-UX-017)", () => {
  it("renders nothing while online", () => {
    render(<ConnectionBanner />);

    expect(screen.queryByText(BANNER_TEXT)).toBeNull();
  });

  it("renders the offline banner once the offline event fires", () => {
    render(<ConnectionBanner />);

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });

    expect(screen.getByText(BANNER_TEXT)).not.toBeNull();
  });

  it("clears the banner once the online event fires", () => {
    render(<ConnectionBanner />);
    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
    });

    expect(screen.queryByText(BANNER_TEXT)).toBeNull();
  });
});