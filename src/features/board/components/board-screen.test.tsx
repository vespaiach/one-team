import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { BoardCard, BoardPerson, BoardView } from "../server/board-queries";
import { BoardScreen } from "./board-screen";

const { pushMock, replaceMock, refreshMock, useSearchParamsMock } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  replaceMock: vi.fn(),
  refreshMock: vi.fn(),
  useSearchParamsMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock, push: pushMock, replace: replaceMock }),
  useSearchParams: useSearchParamsMock,
}));

const BACKLOG = "0198d2b1-0000-7000-8000-0000000000c1";
const IN_PROGRESS = "0198d2b1-0000-7000-8000-0000000000c2";
const DONE = "0198d2b1-0000-7000-8000-0000000000c3";

const GRACE: BoardPerson = {
  id: "0198d2b1-0000-7000-8000-0000000000a1",
  firstName: "Grace",
  lastName: "Hopper",
  avatarUrl: null,
};
const ADA: BoardPerson = {
  id: "0198d2b1-0000-7000-8000-0000000000a2",
  firstName: "Ada",
  lastName: "Lovelace",
  avatarUrl: null,
};

function card(
  number: number,
  columnId: string,
  order: number,
  lanes: Partial<Pick<BoardCard, "assigneeId" | "priority">> = {},
): BoardCard {
  return {
    id: `0198d2b1-0000-7000-8000-00000000${String(number).padStart(4, "0")}`,
    key: `WEB-${number}`,
    title: `Issue number ${number}`,
    columnId,
    assigneeId: lanes.assigneeId ?? null,
    priority: lanes.priority ?? "none",
    dueDate: null,
    labels: [],
    assignee: null,
    commentCount: 0,
    order,
  };
}

function board(cards: BoardCard[], assigneePool: BoardPerson[] = []): BoardView {
  return {
    project: {
      id: "0198d2b1-0000-7000-8000-0000000000p1",
      key: "WEB",
      name: "Website Redesign",
      status: "active",
    },
    columns: [
      { id: BACKLOG, name: "Backlog" },
      { id: IN_PROGRESS, name: "In Progress" },
      { id: DONE, name: "Done" },
    ],
    cards,
    assigneePool,
    assignedOutsidePool: [],
    canWrite: true,
    writeReason: "",
  };
}

const SPREAD = [
  card(11, IN_PROGRESS, 0),
  card(12, BACKLOG, 1),
  card(13, IN_PROGRESS, 2),
  card(14, BACKLOG, 3),
];

function laneNames(): (string | null)[] {
  return screen.getAllByRole("grid").map((grid) => grid.getAttribute("aria-label"));
}

function keysIn(laneName: string): string[] {
  return within(screen.getByRole("grid", { name: laneName }))
    .queryAllByRole("row")
    .map((row) => row.getAttribute("aria-label"))
    .filter((name): name is string => name !== null);
}

describe("BoardScreen — one lane per column, in board order (FR-015 default, FR-016)", () => {
  it("renders the project's columns as lanes in the order the board read returned them", () => {
    render(<BoardScreen board={board(SPREAD)} />);

    expect(laneNames()).toEqual(["Backlog", "In Progress", "Done"]);
  });

  it("renders a lane for a column holding no cards", () => {
    render(<BoardScreen board={board(SPREAD)} />);

    expect(keysIn("Done")).toEqual([]);
    expect(within(screen.getByRole("grid", { name: "Done" })).getByText("No cards")).not.toBeNull();
  });
});

describe("BoardScreen — every card lands in exactly one lane (FR-016)", () => {
  it("places each card under its own column and nowhere else", () => {
    render(<BoardScreen board={board(SPREAD)} />);

    expect(keysIn("Backlog")).toEqual(["WEB-12 Issue number 12", "WEB-14 Issue number 14"]);
    expect(keysIn("In Progress")).toEqual(["WEB-11 Issue number 11", "WEB-13 Issue number 13"]);
  });

  it("renders each card's key exactly once across the whole board", () => {
    render(<BoardScreen board={board(SPREAD)} />);

    for (const entry of SPREAD) {
      expect(screen.getAllByText(entry.key)).toHaveLength(1);
    }
  });
});

describe("BoardScreen — the lane strip (FR-006)", () => {
  it("lays the lanes out as one horizontally scrolling strip", () => {
    const { container } = render(<BoardScreen board={board(SPREAD)} />);

    const strip = container.querySelector('[data-region="board"]');
    expect(strip).not.toBeNull();
    expect(strip?.className).toContain("flex");
    expect(strip?.className).toContain("overflow-x-auto");
  });

  it("fixes every lane at the same width so the strip overflows rather than reflowing", () => {
    const { container } = render(<BoardScreen board={board(SPREAD)} />);

    const lanes = container.querySelectorAll('[data-region="lane"]');
    expect(lanes).toHaveLength(3);
    for (const lane of lanes) {
      expect(lane.className).toContain("w-[288px]");
      expect(lane.className).toContain("shrink-0");
    }
  });

  it("carries no responsive breakpoint anywhere in the markup", () => {
    const { container } = render(<BoardScreen board={board(SPREAD)} />);

    for (const element of container.querySelectorAll("*")) {
      for (const token of element.className.toString().split(/\s+/)) {
        expect(token).not.toMatch(/^(sm|md|lg|xl|2xl|max-sm|max-md|max-lg|max-xl):/);
      }
    }
  });
});

describe("BoardScreen — a lane renders every card it holds (the hundreds-of-cards edge case)", () => {
  it("renders all of a crowded lane's cards with no pagination and no show-more control", () => {
    const crowded = Array.from({ length: 40 }, (_, index) => card(100 + index, BACKLOG, index));

    render(<BoardScreen board={board(crowded)} />);

    expect(keysIn("Backlog")).toHaveLength(40);
    expect(screen.queryByRole("button", { name: /show more/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /next/i })).toBeNull();
    expect(screen.queryByRole("navigation")).toBeNull();
  });
});
const POOL = [GRACE, ADA];

const MIXED = [
  card(21, IN_PROGRESS, 0, { assigneeId: ADA.id, priority: "urgent" }),
  card(22, BACKLOG, 1, { priority: "low" }),
  card(23, IN_PROGRESS, 2, { assigneeId: GRACE.id, priority: "urgent" }),
];

const MIXED_REORDERED = [MIXED[2], MIXED[0], MIXED[1]].filter(
  (entry): entry is BoardCard => entry !== undefined,
);

function renderBoard(view: BoardView) {
  return render(<BoardScreen board={view} />);
}

function groupBy(): HTMLElement {
  return screen.getByRole("button", { name: /Group by/ });
}

function pressKey(key: string) {
  const target = document.activeElement ?? document.body;
  fireEvent.keyDown(target, { key });
  fireEvent.keyUp(target, { key });
}

async function chooseGrouping(name: string) {
  const button = groupBy();
  button.focus();
  fireEvent.keyDown(button, { key: "ArrowDown" });
  fireEvent.keyUp(button, { key: "ArrowDown" });
  await screen.findByRole("listbox");
  pressKey("Home");
  for (let step = 0; step < 3 && document.activeElement?.textContent !== name; step += 1) {
    pressKey("ArrowDown");
  }
  pressKey("Enter");
  await waitFor(() => expect(groupBy().textContent).toBe(name));
}

function cardNames(): string[] {
  return screen
    .getAllByRole("row")
    .map((row) => row.getAttribute("aria-label"))
    .filter((name): name is string => name !== null)
    .sort();
}

function dragHandles(): string[] {
  return screen
    .getAllByRole("button", { name: /^Drag / })
    .map((handle) => handle.getAttribute("aria-label") ?? "")
    .sort();
}

describe("BoardScreen — the header names the project, on the board tab (FR-004, FR-007)", () => {
  it("shows the project's name and selects the Board tab", () => {
    renderBoard(board(SPREAD));

    const header = screen.getByRole("banner");
    expect(within(header).getByText("Website Redesign")).not.toBeNull();
    expect(screen.getByRole("tab", { name: "Board" }).getAttribute("aria-selected")).toBe("true");
  });
});

describe("BoardScreen — the grouping control belongs to the header (FR-005)", () => {
  it("hands the Group by control to the header it is given, adding no second one", () => {
    const { container } = renderBoard(board(MIXED, POOL));

    const header = screen.getByRole("banner");
    expect(header.contains(groupBy())).toBe(true);
    expect(screen.getAllByRole("button", { name: /Group by/ })).toHaveLength(1);
    expect(container.querySelector('[data-region="board"]')?.contains(groupBy())).toBe(false);
  });
});

describe("BoardScreen — the three lane sets (FR-021, SC-006)", () => {
  it("starts on Column", () => {
    renderBoard(board(MIXED, POOL));

    expect(groupBy().textContent).toBe("Column");
    expect(laneNames()).toEqual(["Backlog", "In Progress", "Done"]);
  });

  it("regroups into Unassigned, then the pool, when Assignee is chosen", async () => {
    renderBoard(board(MIXED, POOL));

    await chooseGrouping("Assignee");

    expect(laneNames()).toEqual(["Unassigned", "Grace Hopper", "Ada Lovelace"]);
    expect(keysIn("Grace Hopper")).toEqual(["WEB-23 Issue number 23"]);
    expect(keysIn("Unassigned")).toEqual(["WEB-22 Issue number 22"]);
  });

  it("regroups into exactly five lanes when Priority is chosen", async () => {
    renderBoard(board(MIXED, POOL));

    await chooseGrouping("Priority");

    expect(laneNames()).toEqual(["Urgent", "High", "Medium", "Low", "No priority"]);
    expect(keysIn("Urgent")).toEqual(["WEB-21 Issue number 21", "WEB-23 Issue number 23"]);
  });
});

describe("BoardScreen — the same cards under every grouping (FR-021, SC-006)", () => {
  it("shows every card exactly once, with the same face and the same drag gesture, in all three", async () => {
    renderBoard(board(MIXED, POOL));

    const columnCards = cardNames();
    const columnHandles = dragHandles();

    await chooseGrouping("Assignee");
    expect(cardNames()).toEqual(columnCards);
    expect(dragHandles()).toEqual(columnHandles);

    await chooseGrouping("Priority");
    expect(cardNames()).toEqual(columnCards);
    expect(dragHandles()).toEqual(columnHandles);
    expect(columnCards).toHaveLength(MIXED.length);
  });
});

describe("BoardScreen — the choice is component state and nothing else (FR-020, research D-6)", () => {
  it("reaches no URL, no cookie and no second route", async () => {
    const cookiesBefore = document.cookie;
    renderBoard(board(MIXED, POOL));

    await chooseGrouping("Assignee");
    await chooseGrouping("Priority");

    expect(document.cookie).toBe(cookiesBefore);
    expect(pushMock).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
    expect(useSearchParamsMock).not.toHaveBeenCalled();
  });

  it("resets to Column on a remount", async () => {
    const { unmount } = renderBoard(board(MIXED, POOL));

    await chooseGrouping("Priority");
    expect(groupBy().textContent).toBe("Priority");
    unmount();

    renderBoard(board(MIXED, POOL));

    expect(groupBy().textContent).toBe("Column");
    expect(laneNames()).toEqual(["Backlog", "In Progress", "Done"]);
  });
});

describe("BoardScreen — a reorder made under one grouping shows under the others (FR-025)", () => {
  it("carries the new relative position across and compensates for it nowhere", async () => {
    const { rerender } = renderBoard(board(MIXED, POOL));

    await chooseGrouping("Assignee");
    expect(keysIn("Ada Lovelace")).toEqual(["WEB-21 Issue number 21"]);

    rerender(<BoardScreen board={board(MIXED_REORDERED, POOL)} />);
    await chooseGrouping("Column");

    expect(keysIn("In Progress")).toEqual(["WEB-23 Issue number 23", "WEB-21 Issue number 21"]);
  });
});