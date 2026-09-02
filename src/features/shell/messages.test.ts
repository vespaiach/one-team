import { afterEach, describe, expect, it } from "vitest";
import { messages, raiseMessage } from "./messages";

afterEach(() => {
  messages.clear();
});

describe("messages (FR-033, OT-UX-016)", () => {
  it("shows at most three toasts at once", () => {
    raiseMessage("error", "first");
    raiseMessage("error", "second");
    raiseMessage("error", "third");
    raiseMessage("error", "fourth");

    expect(messages.visibleToasts).toHaveLength(3);
  });

  it("auto-dismisses after five seconds", () => {
    raiseMessage("success", "saved");

    expect(messages.visibleToasts[0]?.timeout).toBe(5000);
  });

  it("adds each raised message as its own entry, never coalescing identical refusals", () => {
    raiseMessage("error", "Something went wrong. Try again.");
    raiseMessage("error", "Something went wrong. Try again.");

    expect(messages.visibleToasts).toHaveLength(2);
  });

  it("carries the message kind and text on the toast content", () => {
    raiseMessage("warning", "heads up");

    expect(messages.visibleToasts[0]?.content).toEqual({ kind: "warning", text: "heads up" });
  });
});