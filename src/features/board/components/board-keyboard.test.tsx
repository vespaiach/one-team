import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Drop, Lane } from "../lane-model";
import type { BoardCard } from "../server/board-queries";
import { BoardLane } from "./board-lane";

const IN_PROGRESS = "0198d2b1-0000-7000-8000-0000000000c1";
const BACKLOG = "0198d2b1-0000-7000-8000-0000000000c2";
const DONE = "0198d2b1-0000-7000-8000-0000000000c3";

function card(number: number, title: string, columnId: string, order: number): BoardCard {
  return {
    id: `0198d2b1-0000-7000-8000-00000000${String(number).padStart(4, "0")}`,
    key: `WEB-${number}`,
    title,
    columnId,
    assigneeId: null,
    priority: "none",
    dueDate: null,
    labels: [],
    assignee: null,
    commentCount: 0,
    order,
  };
}

const WEB_7 = card(7, "Rework the sign-in copy", IN_PROGRESS, 0);
const WEB_2 = card(2, "Audit the empty states", IN_PROGRESS, 1);
const WEB_12 = card(12, "Retire the legacy tokens", BACKLOG, 2);
const WEB_14 = card(14, "Trim the seed data", BACKLOG, 3);

const LANES: Lane<BoardCard>[] = [
  { id: IN_PROGRESS, name: "In Progress", cards: [WEB_7, WEB_2] },
  { id: BACKLOG, name: "Backlog", cards: [WEB_12, WEB_14] },
  { id: DONE, name: "Done", cards: [] },
];

const WEB_7_HANDLE = "Drag WEB-7 Rework the sign-in copy";

function renderLanes(onDrop: (drop: Drop) => void) {
  return render(
    <div>
      {LANES.map((lane) => (
        <BoardLane
          key={lane.id}
          lane={lane}
          projectKey="WEB"
          onDrop={onDrop}
        />
      ))}
    </div>,
  );
}

afterEach(() => {
  const target = document.activeElement ?? document.body;
  fireEvent.keyDown(target, { key: "Escape" });
  fireEvent.keyUp(target, { key: "Escape" });
});

function activeElement() {
  return document.activeElement as HTMLElement;
}

function currentLabel() {
  return activeElement().getAttribute("aria-label");
}

function pressKey(key: string) {
  fireEvent.keyDown(activeElement(), { key });
  fireEvent.keyUp(activeElement(), { key });
}

async function liftCard(handleName: string) {
  const handle = screen.getByRole("button", { name: handleName });
  handle.focus();
  pressKey("Enter");
  await waitFor(() => expect(currentLabel()).toMatch(/^(Insert|Drop on)/));
}

function focusedLaneName() {
  return activeElement().closest('[data-region="lane"]')?.querySelector("h2")?.textContent ?? null;
}

async function stepUntil(handleName: string, atTarget: () => boolean, described: string) {
  await liftCard(handleName);
  for (let lane = 0; lane < 4; lane += 1) {
    for (let step = 0; step < 8; step += 1) {
      if (atTarget()) {
        return;
      }
      pressKey("ArrowDown");
    }
    pressKey("Tab");
  }
  throw new Error(`never reached ${described} — stopped at "${currentLabel()}"`);
}

async function stepToIndicator(handleName: string, indicatorLabel: string) {
  await stepUntil(handleName, () => currentLabel() === indicatorLabel, `"${indicatorLabel}"`);
}

async function stepToLaneRoot(handleName: string, laneName: string) {
  await stepUntil(
    handleName,
    () => currentLabel() === "Drop on" && focusedLaneName() === laneName,
    `the root of "${laneName}"`,
  );
}

const SHAPE_CLASS = /^(?:data-\[[^\]]+\]:)?(?:h|w|min-h|min-w|outline|ring|border)-(?:\d|\[)/;

function classOf(element: Element) {
  return element.getAttribute("class") ?? "";
}

function marksItselfBeyondColour(element: Element) {
  return classOf(element)
    .split(/\s+/)
    .some((token) => SHAPE_CLASS.test(token));
}

function unmarkedDropTargets(container: HTMLElement) {
  return Array.from(container.querySelectorAll("[data-drop-target]"))
    .filter((element) => !marksItselfBeyondColour(element))
    .map(classOf);
}

function dropTargetCount(container: HTMLElement) {
  return container.querySelectorAll("[data-drop-target]").length;
}

describe("BoardLane — the whole drag runs on the keyboard alone (FR-043, SC-015)", () => {
  it("carries a card to an insertion point in another lane with key events only", async () => {
    const onDrop = vi.fn();
    renderLanes(onDrop);

    await stepToIndicator(WEB_7_HANDLE, "Insert before WEB-12 Retire the legacy tokens");
    pressKey("Enter");

    await waitFor(() => expect(onDrop).toHaveBeenCalledTimes(1));
    expect(onDrop).toHaveBeenCalledWith({
      issueId: WEB_7.id,
      laneId: BACKLOG,
      targetIssueId: WEB_12.id,
      placement: "before",
    });
  });

  it("carries a card onto an empty lane with key events only", async () => {
    const onDrop = vi.fn();
    renderLanes(onDrop);

    await stepToLaneRoot(WEB_7_HANDLE, "Done");
    pressKey("Enter");

    await waitFor(() => expect(onDrop).toHaveBeenCalledTimes(1));
    expect(onDrop).toHaveBeenCalledWith({
      issueId: WEB_7.id,
      laneId: DONE,
      targetIssueId: null,
      placement: "after",
    });
  });

  it("cancels on Escape, reporting no drop and returning focus to the card's own handle", async () => {
    const onDrop = vi.fn();
    renderLanes(onDrop);

    await stepToLaneRoot(WEB_7_HANDLE, "Done");
    pressKey("Escape");

    await waitFor(() => expect(activeElement()).toBe(screen.getByRole("button", { name: WEB_7_HANDLE })));
    expect(onDrop).not.toHaveBeenCalled();
  });
});

describe("BoardLane — every drop target announces its lane (FR-043)", () => {
  it("names each lane's drop region for that lane", () => {
    renderLanes(vi.fn());

    expect(screen.getByRole("grid", { name: "In Progress" })).not.toBeNull();
    expect(screen.getByRole("grid", { name: "Backlog" })).not.toBeNull();
    expect(screen.getByRole("grid", { name: "Done" })).not.toBeNull();
  });

  it("names the drop target on an empty lane for that lane", async () => {
    renderLanes(vi.fn());

    await stepToLaneRoot(WEB_7_HANDLE, "Done");

    expect(activeElement()).toBe(screen.getByRole("button", { name: "Drop on Done" }));
  });

  it("names the drop target on a lane that already holds cards for that lane", async () => {
    renderLanes(vi.fn());

    await stepToLaneRoot(WEB_7_HANDLE, "Backlog");

    expect(activeElement()).toBe(screen.getByRole("button", { name: "Drop on Backlog" }));
  });
});

describe("BoardLane — every control keeps its name and the app's focus outline (FR-043, SC-015)", () => {
  it("names every control a lane offers and takes focus on each", () => {
    const { container } = renderLanes(vi.fn());

    const controls = Array.from(container.querySelectorAll("a, button"));
    expect(controls).toHaveLength(8);
    for (const control of controls) {
      expect(control.getAttribute("aria-label")).not.toBeNull();
      (control as HTMLElement).focus();
      expect(activeElement()).toBe(control);
    }
  });

  it("suppresses the focus outline on nothing it renders", () => {
    const { container } = renderLanes(vi.fn());

    const suppressed = Array.from(container.querySelectorAll("*")).filter((element) =>
      /\boutline-(?:none|0)\b/.test(classOf(element)),
    );
    expect(suppressed).toEqual([]);
    expect(container.querySelectorAll("[style*='outline']")).toHaveLength(0);
  });
});

describe("BoardLane — the drag stays visible while it runs, never by colour alone (FR-043, SC-015)", () => {
  it("marks the insertion point the card would take, and by more than a colour", async () => {
    const { container } = renderLanes(vi.fn());

    await stepToIndicator(WEB_7_HANDLE, "Insert before WEB-12 Retire the legacy tokens");

    expect(dropTargetCount(container)).toBeGreaterThan(0);
    expect(unmarkedDropTargets(container)).toEqual([]);
  });

  it("marks the empty lane the card would land in, and by more than a colour", async () => {
    const { container } = renderLanes(vi.fn());

    await stepToLaneRoot(WEB_7_HANDLE, "Done");

    expect(dropTargetCount(container)).toBeGreaterThan(0);
    expect(unmarkedDropTargets(container)).toEqual([]);
  });
});