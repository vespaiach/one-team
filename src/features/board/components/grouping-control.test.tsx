import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GroupingControl } from "./grouping-control";

const SOURCE = readFileSync(
  join(process.cwd(), "src", "features", "board", "components", "grouping-control.tsx"),
  "utf8",
);

function trigger(): HTMLElement {
  return screen.getByRole("button", { name: /Group by/ });
}

async function openWithKeyboard(): Promise<HTMLElement[]> {
  const button = trigger();
  button.focus();
  fireEvent.keyDown(button, { key: "ArrowDown" });
  fireEvent.keyUp(button, { key: "ArrowDown" });
  await screen.findByRole("listbox");
  return screen.getAllByRole("option");
}

function pressKey(key: string) {
  const target = document.activeElement ?? document.body;
  fireEvent.keyDown(target, { key });
  fireEvent.keyUp(target, { key });
}

describe("GroupingControl — the header's one per-screen control (FR-015, SC-015)", () => {
  it("carries the accessible name Group by", () => {
    render(<GroupingControl onChange={vi.fn()} />);

    expect(trigger()).not.toBeNull();
  });

  it("defaults to Column", () => {
    render(<GroupingControl onChange={vi.fn()} />);

    expect(trigger().textContent).toBe("Column");
  });

  it("offers exactly Column, Assignee and Priority", async () => {
    render(<GroupingControl onChange={vi.fn()} />);

    const options = await openWithKeyboard();

    expect(options.map((option) => option.textContent)).toEqual(["Column", "Assignee", "Priority"]);
  });

  it("shows the grouping its caller hands it as the selected option", async () => {
    render(
      <GroupingControl
        grouping="priority"
        onChange={vi.fn()}
      />,
    );

    expect(trigger().textContent).toBe("Priority");

    const options = await openWithKeyboard();
    const selected = options.filter((option) => option.getAttribute("aria-selected") === "true");

    expect(selected.map((option) => option.textContent)).toEqual(["Priority"]);
  });

  it("is opened, navigated and chosen from with the keyboard alone", async () => {
    const onChange = vi.fn();
    render(<GroupingControl onChange={onChange} />);

    await openWithKeyboard();
    pressKey("ArrowDown");
    pressKey("Enter");

    expect(onChange).toHaveBeenCalledWith("assignee");
  });

  it("leaves the shown grouping to its caller rather than moving on its own", async () => {
    render(<GroupingControl onChange={vi.fn()} />);

    await openWithKeyboard();
    pressKey("ArrowDown");
    pressKey("Enter");

    expect(trigger().textContent).toBe("Column");
  });

  it("adds no sort control and no filter control to the screen", async () => {
    render(<GroupingControl onChange={vi.fn()} />);
    await openWithKeyboard();

    for (const element of document.body.querySelectorAll("button, input, select, a, [role]")) {
      expect(element.textContent ?? "").not.toMatch(/sort|filter/i);
      expect(element.getAttribute("aria-label") ?? "").not.toMatch(/sort|filter/i);
    }
    expect(SOURCE).not.toMatch(/sort|filter/i);
  });

  it("presses through React Aria, with no hand-added role and a focus indicator left visible", () => {
    expect(SOURCE).not.toMatch(/\bonClick\b/);
    expect(SOURCE).not.toMatch(/["\s](hover|focus|active):/);
    expect(SOURCE).not.toMatch(/\boutline-(none|0)\b/);
    expect(SOURCE).not.toMatch(/role="(button|listbox|option)"/);
    expect(SOURCE).toMatch(/data-\[focus-visible\]/);
  });
});