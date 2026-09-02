import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { messages, raiseMessage } from "../messages";
import { MessageHost } from "./message-host";

afterEach(() => {
  messages.clear();
});

describe("MessageHost (FR-033, OT-UX-016)", () => {
  it("renders a raised message's text", () => {
    render(<MessageHost />);

    act(() => {
      raiseMessage("error", "Something went wrong. Try again.");
    });

    expect(screen.getByText("Something went wrong. Try again.")).not.toBeNull();
  });

  it("renders at most three visible messages", () => {
    render(<MessageHost />);

    act(() => {
      raiseMessage("error", "one");
      raiseMessage("error", "two");
      raiseMessage("error", "three");
      raiseMessage("error", "four");
    });

    expect(screen.queryByText("one")).toBeNull();
    expect(screen.getByText("four")).not.toBeNull();
  });

  it("renders two entries for two identical refusals rather than coalescing them", () => {
    render(<MessageHost />);

    act(() => {
      raiseMessage("error", "Changes need a connection");
      raiseMessage("error", "Changes need a connection");
    });

    expect(screen.getAllByText("Changes need a connection")).toHaveLength(2);
  });
});