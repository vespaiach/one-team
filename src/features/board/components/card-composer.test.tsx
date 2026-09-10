import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CardComposer, type CardComposerProps } from "./card-composer";

function baseProps(overrides: Partial<CardComposerProps> = {}): CardComposerProps {
  return {
    projectId: "project-1",
    grouping: "column",
    laneId: "column-1",
    firstColumnId: "column-1",
    canWrite: true,
    writeReason: "",
    laneName: "To do",
    laneAcceptsWrite: true,
    onCreate: vi.fn().mockResolvedValue({ status: "ok" }),
    ...overrides,
  };
}

describe("CardComposer", () => {
  it("has no control for opening a fuller form — only the quick-add title field", () => {
    render(<CardComposer {...baseProps()} />);

    expect(screen.getByPlaceholderText("Add a card")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open the full form" })).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("submits the title on Enter", async () => {
    const onCreate = vi.fn().mockResolvedValue({ status: "ok" });
    render(<CardComposer {...baseProps({ onCreate })} />);

    const input = screen.getByPlaceholderText("Add a card");
    fireEvent.change(input, { target: { value: "Ship the thing" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onCreate).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "project-1", title: "Ship the thing", columnId: "column-1" }),
    );
  });
});