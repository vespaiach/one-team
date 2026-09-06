import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MoveIssuePayload, MoveIssueState } from "@/features/issues/actions";
import type { BoardCard, BoardView } from "../server/board-queries";
import { BoardScreen } from "./board-screen";

const moveIssueMock = vi.fn<(input: MoveIssuePayload) => Promise<MoveIssueState>>();
vi.mock("@/features/issues/actions", () => ({
  moveIssue: (input: MoveIssuePayload) => moveIssueMock(input),
  createBoardCard: vi.fn(),
}));

const showToastMock = vi.fn();
vi.mock("@/features/shell/components/toast-region", () => ({
  showToast: (...args: unknown[]) => showToastMock(...args),
}));

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

beforeEach(() => {
  moveIssueMock.mockReset();
  showToastMock.mockClear();
  refreshMock.mockClear();
});

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

const WEB_11 = card(11, IN_PROGRESS, 0);
const WEB_12 = card(12, BACKLOG, 1);
const WEB_13 = card(13, IN_PROGRESS, 2);
const WEB_15 = card(15, BACKLOG, -1);

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

const RENDERED = board([WEB_11, WEB_12, WEB_13]);
const FRESH_WITH_NEW_NEIGHBOUR = board([WEB_15, WEB_11, WEB_12, WEB_13]);
const FRESH_WITHOUT_ELEVEN = board([WEB_12, WEB_13]);

const NEW_NEIGHBOUR_INDICATOR = "Insert before WEB-15 Issue number 15";

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
  fireEvent.keyDown(handle, { key: "Enter" });
  fireEvent.keyUp(handle, { key: "Enter" });
  await waitFor(() => expect(currentLabel()).toMatch(/^(Insert|Drop on)/));
}

function dropOn(indicatorLabel: string) {
  for (let lane = 0; lane < 4; lane += 1) {
    for (let step = 0; step < 8; step += 1) {
      if (currentLabel() === indicatorLabel) {
        pressKey("Enter");
        return;
      }
      pressKey("ArrowDown");
    }
    pressKey("Tab");
  }
  throw new Error(`never reached "${indicatorLabel}" — stopped at "${currentLabel()}"`);
}

function keysIn(laneName: string): (string | null)[] {
  return within(screen.getByRole("grid", { name: laneName }))
    .queryAllByRole("link")
    .map((link) => link.getAttribute("aria-label"));
}

function dragging() {
  return currentLabel() ?? "";
}

describe("BoardScreen — a re-query lands mid-drag (FR-055, SC-009)", () => {
  it("updates the board underneath the drag without cancelling it", async () => {
    moveIssueMock.mockReturnValue(new Promise(() => {}));
    const { rerender } = render(<BoardScreen board={RENDERED} />);

    await liftCard("WEB-11 Issue number 11");
    rerender(<BoardScreen board={FRESH_WITH_NEW_NEIGHBOUR} />);

    expect(dragging()).toMatch(/^(Insert|Drop on)/);
    pressKey("Escape");

    expect(keysIn("Backlog")).toEqual(["WEB-15 Issue number 15", "WEB-12 Issue number 12"]);
    expect(moveIssueMock).not.toHaveBeenCalled();
  });

  it("resolves the drop against the refreshed neighbours rather than the stale ones", async () => {
    moveIssueMock.mockReturnValue(new Promise(() => {}));
    const { rerender } = render(<BoardScreen board={RENDERED} />);

    await liftCard("WEB-11 Issue number 11");
    rerender(<BoardScreen board={FRESH_WITH_NEW_NEIGHBOUR} />);
    dropOn(NEW_NEIGHBOUR_INDICATOR);

    await waitFor(() => expect(moveIssueMock).toHaveBeenCalledTimes(1));
    expect(moveIssueMock).toHaveBeenCalledWith({
      issueId: WEB_11.id,
      grouping: "column",
      laneId: BACKLOG,
      targetIssueId: WEB_15.id,
      placement: "before",
    });
  });
});

describe("BoardScreen — a re-query never overwrites an in-flight drop (FR-056)", () => {
  it("keeps the caller's own optimistic position when older rows land first", async () => {
    moveIssueMock.mockReturnValue(new Promise(() => {}));
    const { rerender } = render(<BoardScreen board={RENDERED} />);

    await liftCard("WEB-11 Issue number 11");
    dropOn("Insert before WEB-12 Issue number 12");

    await waitFor(() => expect(moveIssueMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(keysIn("Backlog")).toEqual(["WEB-11 Issue number 11", "WEB-12 Issue number 12"]),
    );

    rerender(<BoardScreen board={board([WEB_11, WEB_12, WEB_13])} />);

    expect(keysIn("Backlog")).toEqual(["WEB-11 Issue number 11", "WEB-12 Issue number 12"]);
    expect(keysIn("In Progress")).toEqual(["WEB-13 Issue number 13"]);
  });

  it("replays the in-flight drop over each set of newer rows rather than over the first", async () => {
    moveIssueMock.mockReturnValue(new Promise(() => {}));
    const { rerender } = render(<BoardScreen board={RENDERED} />);

    await liftCard("WEB-11 Issue number 11");
    dropOn("Insert before WEB-12 Issue number 12");

    await waitFor(() => expect(moveIssueMock).toHaveBeenCalledTimes(1));

    rerender(<BoardScreen board={FRESH_WITH_NEW_NEIGHBOUR} />);

    expect(keysIn("Backlog")).toEqual([
      "WEB-15 Issue number 15",
      "WEB-11 Issue number 11",
      "WEB-12 Issue number 12",
    ]);
    expect(showToastMock).not.toHaveBeenCalled();
  });

  it("hands the card back to the newest rows once its own call has settled", async () => {
    moveIssueMock.mockResolvedValue({ ok: true });
    const { rerender } = render(<BoardScreen board={RENDERED} />);

    await liftCard("WEB-11 Issue number 11");
    dropOn("Insert before WEB-12 Issue number 12");

    await waitFor(() => expect(moveIssueMock).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(keysIn("Backlog")).toEqual(["WEB-11 Issue number 11", "WEB-12 Issue number 12"]),
    );

    rerender(<BoardScreen board={board([WEB_11, WEB_12, WEB_13])} />);

    expect(keysIn("Backlog")).toEqual(["WEB-12 Issue number 12"]);
    expect(keysIn("In Progress")).toEqual(["WEB-11 Issue number 11", "WEB-13 Issue number 13"]);
    expect(showToastMock).not.toHaveBeenCalled();
  });
});

describe("BoardScreen — a re-query removes the card being dragged (US5 sc.8)", () => {
  it("ends the drag with no write and no error", async () => {
    moveIssueMock.mockReturnValue(new Promise(() => {}));
    const { rerender } = render(<BoardScreen board={RENDERED} />);

    await liftCard("WEB-11 Issue number 11");
    rerender(<BoardScreen board={FRESH_WITHOUT_ELEVEN} />);

    expect(screen.queryByRole("link", { name: "WEB-11 Issue number 11" })).toBeNull();

    pressKey("Enter");
    pressKey("Escape");

    expect(moveIssueMock).not.toHaveBeenCalled();
    expect(showToastMock).not.toHaveBeenCalled();
    expect(keysIn("Backlog")).toEqual(["WEB-12 Issue number 12"]);
  });

  it("discards the pending move for a card the newest rows no longer carry", async () => {
    moveIssueMock.mockReturnValue(new Promise(() => {}));
    const { rerender } = render(<BoardScreen board={RENDERED} />);

    await liftCard("WEB-11 Issue number 11");
    dropOn("Insert before WEB-12 Issue number 12");

    await waitFor(() => expect(moveIssueMock).toHaveBeenCalledTimes(1));

    rerender(<BoardScreen board={FRESH_WITHOUT_ELEVEN} />);

    expect(keysIn("Backlog")).toEqual(["WEB-12 Issue number 12"]);
    expect(keysIn("In Progress")).toEqual(["WEB-13 Issue number 13"]);
    expect(showToastMock).not.toHaveBeenCalled();
  });
});