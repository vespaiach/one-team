import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Button } from "react-aria-components/Button";
import { GridList, GridListItem } from "react-aria-components/GridList";
import { useDragAndDrop } from "react-aria-components/useDragAndDrop";
import { describe, expect, it, vi } from "vitest";
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
const WEB_9 = card(9, "Drop the unused tokens", IN_PROGRESS, 2);
const WEB_12 = card(12, "Retire the legacy tokens", BACKLOG, 3);
const WEB_14 = card(14, "Trim the seed data", BACKLOG, 4);

const LANES: Lane<BoardCard>[] = [
  { id: IN_PROGRESS, name: "In Progress", cards: [WEB_7, WEB_2, WEB_9] },
  { id: BACKLOG, name: "Backlog", cards: [WEB_12, WEB_14] },
  { id: DONE, name: "Done", cards: [] },
];

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

async function liftCard(cardName: string) {
  const handle = screen.getByRole("button", { name: `Drag ${cardName}` });
  handle.focus();
  expect(document.activeElement).toBe(handle);
  fireEvent.keyDown(handle, { key: "Enter" });
  fireEvent.keyUp(handle, { key: "Enter" });
  await waitFor(() => expect(currentLabel()).toMatch(/^(Insert|Drop on)/));
}

function focusedLaneName() {
  return activeElement().closest('[data-region="lane"]')?.querySelector("h2")?.textContent ?? null;
}

async function dragCardUntil(cardName: string, atTarget: () => boolean, described: string) {
  await liftCard(cardName);
  for (let lane = 0; lane < 4; lane += 1) {
    for (let step = 0; step < 8; step += 1) {
      if (atTarget()) {
        pressKey("Enter");
        return;
      }
      pressKey("ArrowDown");
    }
    pressKey("Tab");
  }
  throw new Error(`never reached ${described} — stopped at "${currentLabel()}"`);
}

async function dragCardTo(cardName: string, indicatorLabel: string) {
  await dragCardUntil(cardName, () => currentLabel() === indicatorLabel, `"${indicatorLabel}"`);
}

async function dragCardOntoEmptyLane(cardName: string, laneName: string) {
  await dragCardUntil(
    cardName,
    () => currentLabel() === "Drop on" && focusedLaneName() === laneName,
    `the root of "${laneName}"`,
  );
}

describe("BoardLane — every card is draggable by the keyboard (FR-043, FR-044)", () => {
  it("gives every card a drag affordance named for its issue", () => {
    renderLanes(vi.fn());

    expect(screen.getByRole("button", { name: "Drag WEB-7 Rework the sign-in copy" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Drag WEB-2 Audit the empty states" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Drag WEB-12 Retire the legacy tokens" })).not.toBeNull();
  });

  it("marks every card row as draggable", () => {
    const { container } = renderLanes(vi.fn());

    expect(container.querySelectorAll("[data-allows-dragging]")).toHaveLength(5);
  });
});

describe("BoardLane — the three drop shapes (research C-2)", () => {
  it("reports a drop between cards in its own lane against that card and that position", async () => {
    const onDrop = vi.fn();
    renderLanes(onDrop);

    await dragCardTo(
      "WEB-7 Rework the sign-in copy",
      "Insert between WEB-2 Audit the empty states and WEB-9 Drop the unused tokens",
    );

    await waitFor(() => expect(onDrop).toHaveBeenCalledTimes(1));
    expect(onDrop).toHaveBeenCalledWith({
      issueId: WEB_7.id,
      laneId: IN_PROGRESS,
      targetIssueId: WEB_9.id,
      placement: "before",
    });
  });

  it("reports a drop into another lane against that lane's id", async () => {
    const onDrop = vi.fn();
    renderLanes(onDrop);

    await dragCardTo("WEB-7 Rework the sign-in copy", "Insert before WEB-12 Retire the legacy tokens");

    await waitFor(() => expect(onDrop).toHaveBeenCalledTimes(1));
    expect(onDrop).toHaveBeenCalledWith({
      issueId: WEB_7.id,
      laneId: BACKLOG,
      targetIssueId: WEB_12.id,
      placement: "before",
    });
  });

  it("reports a drop on an empty lane as that lane's foot", async () => {
    const onDrop = vi.fn();
    renderLanes(onDrop);

    await dragCardOntoEmptyLane("WEB-7 Rework the sign-in copy", "Done");

    await waitFor(() => expect(onDrop).toHaveBeenCalledTimes(1));
    expect(onDrop).toHaveBeenCalledWith({
      issueId: WEB_7.id,
      laneId: DONE,
      targetIssueId: null,
      placement: "after",
    });
  });

  it("carries a neighbour id and a placement and never an index the client computed", async () => {
    const onDrop = vi.fn();
    renderLanes(onDrop);

    await dragCardTo("WEB-7 Rework the sign-in copy", "Insert before WEB-12 Retire the legacy tokens");

    await waitFor(() => expect(onDrop).toHaveBeenCalledTimes(1));
    const payload = onDrop.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(["issueId", "laneId", "placement", "targetIssueId"]);
    expect(Object.values(payload).some((value) => typeof value === "number")).toBe(false);
  });
});

describe("BoardLane — one accepted drag type and nothing else (FR-044, research C-2)", () => {
  function ForeignList() {
    const { dragAndDropHooks } = useDragAndDrop({
      getItems: (keys) => [...keys].map((key) => ({ "text/plain": String(key) })),
    });

    return (
      <GridList
        aria-label="Foreign"
        items={[{ id: "foreign-1", name: "Foreign item" }]}
        dragAndDropHooks={dragAndDropHooks}>
        {(item) => (
          <GridListItem
            id={item.id}
            textValue={item.name}>
            <Button slot="drag">Drag</Button>
            {item.name}
          </GridListItem>
        )}
      </GridList>
    );
  }

  it("refuses a drag that is not a board card, so nothing from elsewhere can land on a lane", async () => {
    const onDrop = vi.fn();
    render(
      <div>
        <ForeignList />
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

    expect(screen.getByRole("button", { name: "Drag WEB-7 Rework the sign-in copy" })).not.toBeNull();

    const handle = screen.getByRole("button", { name: "Drag Foreign item" });
    handle.focus();
    fireEvent.keyDown(handle, { key: "Enter" });
    fireEvent.keyUp(handle, { key: "Enter" });

    for (let step = 0; step < 8; step += 1) {
      expect(currentLabel()).not.toMatch(/^(Insert|Drop on)/);
      pressKey("Tab");
    }

    await waitFor(() => expect(onDrop).not.toHaveBeenCalled());
  });
});