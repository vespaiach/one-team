import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BoardCard, BoardView } from "../server/board-queries";
import { BoardScreen } from "./board-screen";

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

vi.mock("@/features/issues/actions", () => ({
  moveIssue: vi.fn(),
  createBoardCard: vi.fn(),
}));

const BACKLOG = "0198d2b1-0000-7000-8000-0000000000c1";
const IN_PROGRESS = "0198d2b1-0000-7000-8000-0000000000c2";

function card(number: number, columnId: string, order: number): BoardCard {
  return {
    id: `0198d2b1-0000-7000-8000-00000000${String(number).padStart(4, "0")}`,
    key: `WEB-${number}`,
    title: `Issue number ${number}`,
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

function board(cards: BoardCard[]): BoardView {
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
    ],
    cards,
    assigneePool: [],
    assignedOutsidePool: [],
    canWrite: true,
    writeReason: "",
  };
}

const WEB_11 = card(11, BACKLOG, 0);
const WEB_12 = card(12, IN_PROGRESS, 1);
const WEB_13 = card(13, BACKLOG, 2);

const RENDERED = board([WEB_11, WEB_12]);
const FRESH = board([WEB_11, WEB_12, WEB_13]);

const THIRTY_SECONDS = 30_000;

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  });
}

function tick(milliseconds: number) {
  act(() => {
    vi.advanceTimersByTime(milliseconds);
  });
}

function keysIn(laneName: string): (string | null)[] {
  return within(screen.getByRole("grid", { name: laneName }))
    .queryAllByRole("row")
    .map((row) => row.getAttribute("aria-label"));
}

function boardRegion(): Element | null {
  return document.querySelector('[data-region="board"]');
}

function skeletonShapes(): Element[] {
  return [...document.querySelectorAll("[data-shape]")];
}

beforeEach(() => {
  vi.useFakeTimers();
  refreshMock.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  Reflect.deleteProperty(document, "visibilityState");
});

describe("BoardScreen — the board re-queries on an interval and on focus (FR-054, research D-3)", () => {
  it("re-queries every thirty seconds while the tab is visible", () => {
    setVisibility("visible");
    render(<BoardScreen board={RENDERED} />);

    expect(refreshMock).not.toHaveBeenCalled();

    tick(THIRTY_SECONDS - 1);
    expect(refreshMock).not.toHaveBeenCalled();

    tick(1);
    expect(refreshMock).toHaveBeenCalledTimes(1);

    tick(THIRTY_SECONDS);
    expect(refreshMock).toHaveBeenCalledTimes(2);
  });

  it("skips the tick while the tab is hidden and resumes once it is visible again", () => {
    setVisibility("hidden");
    render(<BoardScreen board={RENDERED} />);

    tick(THIRTY_SECONDS * 3);
    expect(refreshMock).not.toHaveBeenCalled();

    setVisibility("visible");
    tick(THIRTY_SECONDS);
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("re-queries immediately when the window regains focus", () => {
    setVisibility("visible");
    render(<BoardScreen board={RENDERED} />);

    fireEvent.focus(window);

    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("tears down the interval and the focus listener on unmount", () => {
    setVisibility("visible");
    const { unmount } = render(<BoardScreen board={RENDERED} />);

    tick(THIRTY_SECONDS);
    expect(refreshMock).toHaveBeenCalledTimes(1);
    unmount();
    refreshMock.mockClear();

    tick(THIRTY_SECONDS * 3);
    fireEvent.focus(window);

    expect(refreshMock).not.toHaveBeenCalled();
  });
});

describe("BoardScreen — a re-query updates in place (FR-007, FR-058, FR-059)", () => {
  it("shows no skeleton and keeps the rendered board mounted when fresh rows land", () => {
    setVisibility("visible");
    const { rerender } = render(<BoardScreen board={RENDERED} />);
    const before = boardRegion();

    tick(THIRTY_SECONDS);
    rerender(<BoardScreen board={FRESH} />);

    expect(skeletonShapes()).toEqual([]);
    expect(boardRegion()).toBe(before);
    expect(keysIn("Backlog")).toEqual(["WEB-11 Issue number 11", "WEB-13 Issue number 13"]);
  });

  it("shifts nothing when the fresh rows are unchanged", () => {
    setVisibility("visible");
    const { rerender } = render(<BoardScreen board={RENDERED} />);
    const before = boardRegion();

    tick(THIRTY_SECONDS);
    rerender(<BoardScreen board={board([WEB_11, WEB_12])} />);

    expect(boardRegion()).toBe(before);
    expect(keysIn("Backlog")).toEqual(["WEB-11 Issue number 11"]);
    expect(keysIn("In Progress")).toEqual(["WEB-12 Issue number 12"]);
    expect(skeletonShapes()).toEqual([]);
  });

  it("renders the server's rows on a revisit rather than what the last visit showed", () => {
    setVisibility("visible");
    const { unmount } = render(<BoardScreen board={FRESH} />);

    expect(keysIn("Backlog")).toEqual(["WEB-11 Issue number 11", "WEB-13 Issue number 13"]);
    unmount();

    render(<BoardScreen board={RENDERED} />);

    expect(keysIn("Backlog")).toEqual(["WEB-11 Issue number 11"]);
  });
});