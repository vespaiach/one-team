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
const DONE = "0198d2b1-0000-7000-8000-0000000000c3";

const ALL_COLUMNS = [
  { id: BACKLOG, name: "Backlog" },
  { id: IN_PROGRESS, name: "In Progress" },
  { id: DONE, name: "Done" },
];

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

function board(cards: BoardCard[], columns = ALL_COLUMNS): BoardView {
  return {
    project: {
      id: "0198d2b1-0000-7000-8000-0000000000p1",
      key: "WEB",
      name: "Website Redesign",
      status: "active",
    },
    columns,
    cards,
    assigneePool: [],
    assignedOutsidePool: [],
    canWrite: true,
    writeReason: "",
  };
}

const RENDERED = board([WEB_11, WEB_12, WEB_13]);
const WITHOUT_ELEVEN = board([WEB_12, WEB_13]);
const WITHOUT_DONE = board([WEB_11, WEB_12, WEB_13], ALL_COLUMNS.slice(0, 2));

function activeElement() {
  return document.activeElement as HTMLElement;
}

function currentLabel() {
  return activeElement().getAttribute("aria-label") ?? "";
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

function dropOn(indicator: RegExp) {
  for (let lane = 0; lane < 4; lane += 1) {
    for (let step = 0; step < 8; step += 1) {
      if (indicator.test(currentLabel())) {
        pressKey("Enter");
        return;
      }
      pressKey("ArrowDown");
    }
    pressKey("Tab");
  }
  throw new Error(`never reached ${indicator} — stopped at "${currentLabel()}"`);
}

async function dragElevenOnto(indicator: RegExp) {
  await liftCard("WEB-11 Issue number 11");
  dropOn(indicator);
  await waitFor(() => expect(moveIssueMock).toHaveBeenCalledTimes(1));
}

function laneNames(): string[] {
  return screen.getAllByRole("grid").map((grid) => grid.getAttribute("aria-label") ?? "");
}

function keysIn(laneName: string): (string | null)[] {
  return within(screen.getByRole("grid", { name: laneName }))
    .queryAllByRole("link")
    .map((link) => link.getAttribute("aria-label"));
}

function renderedKeys(): string[] {
  return laneNames().flatMap((lane) => keysIn(lane).map((key) => key ?? ""));
}

function toastMessages(): string[] {
  return showToastMock.mock.calls.map((call) => (call[0] as { message: string }).message);
}

describe("BoardScreen — a re-query no longer carries a card (FR-045, US5 sc.8)", () => {
  it("takes the card off the board with no error shown", () => {
    const { rerender } = render(<BoardScreen board={RENDERED} />);

    expect(renderedKeys()).toContain("WEB-11 Issue number 11");

    rerender(<BoardScreen board={WITHOUT_ELEVEN} />);

    expect(renderedKeys()).toEqual(["WEB-12 Issue number 12", "WEB-13 Issue number 13"]);
    expect(showToastMock).not.toHaveBeenCalled();
  });

  it("refuses a drop already in flight for it as a missing row rather than a permission one", async () => {
    moveIssueMock.mockResolvedValue({ ok: false, error: "not_found" });
    render(<BoardScreen board={RENDERED} />);

    await dragElevenOnto(/^Insert before WEB-12 Issue number 12$/);

    await waitFor(() => expect(showToastMock).toHaveBeenCalledTimes(1));
    expect(toastMessages()[0]).toMatch(/gone/i);
    expect(toastMessages()[0]).not.toMatch(/member|permission|allowed/i);
    expect(refreshMock).toHaveBeenCalledTimes(1);
    expect(keysIn("In Progress")).toEqual(["WEB-11 Issue number 11", "WEB-13 Issue number 13"]);
  });
});

describe("BoardScreen — a re-query no longer carries a column (US5 sc.9)", () => {
  it("drops the lane under Column grouping and strands no card", async () => {
    moveIssueMock.mockReturnValue(new Promise(() => {}));
    const { rerender } = render(<BoardScreen board={RENDERED} />);

    await dragElevenOnto(/^Drop on$/);
    expect(keysIn("Done")).toEqual(["WEB-11 Issue number 11"]);

    rerender(<BoardScreen board={WITHOUT_DONE} />);

    expect(laneNames()).toEqual(["Backlog", "In Progress"]);
    expect(renderedKeys().toSorted()).toEqual([
      "WEB-11 Issue number 11",
      "WEB-12 Issue number 12",
      "WEB-13 Issue number 13",
    ]);
    expect(showToastMock).not.toHaveBeenCalled();
  });
});

describe("BoardScreen — the connection is lost (FR-045, US5 sc.10)", () => {
  it("names the connection, queues nothing and returns the card", async () => {
    moveIssueMock.mockRejectedValue(new Error("network"));
    render(<BoardScreen board={RENDERED} />);

    await dragElevenOnto(/^Insert before WEB-12 Issue number 12$/);

    await waitFor(() => expect(showToastMock).toHaveBeenCalledTimes(1));
    expect(toastMessages()[0]).toMatch(/connection/i);
    expect(keysIn("Backlog")).toEqual(["WEB-12 Issue number 12"]);
    expect(keysIn("In Progress")).toEqual(["WEB-11 Issue number 11", "WEB-13 Issue number 13"]);
    expect(moveIssueMock).toHaveBeenCalledTimes(1);
    expect(refreshMock).not.toHaveBeenCalled();
  });
});