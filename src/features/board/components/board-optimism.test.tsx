import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

const WEB_11 = card(11, "Rework the sign-in copy", IN_PROGRESS, 0);
const WEB_12 = card(12, "Retire the legacy tokens", BACKLOG, 1);
const WEB_13 = card(13, "Audit the empty states", IN_PROGRESS, 2);
const WEB_14 = card(14, "Trim the seed data", BACKLOG, 3);

const BOARD: BoardView = {
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
  cards: [WEB_11, WEB_12, WEB_13, WEB_14],
  assigneePool: [],
  assignedOutsidePool: [],
  canWrite: true,
  writeReason: "",
};

const FORBIDDEN_REASON = "Only a member of Website Redesign can move its cards.";

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

async function dragCardTo(cardName: string, indicatorLabel: string) {
  await liftCard(cardName);
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

async function dragElevenIntoBacklog() {
  await dragCardTo("WEB-11 Rework the sign-in copy", "Insert before WEB-12 Retire the legacy tokens");
}

function keysIn(laneName: string): (string | null)[] {
  return within(screen.getByRole("grid", { name: laneName }))
    .queryAllByRole("row")
    .map((row) => row.getAttribute("aria-label"));
}

function laneCount(laneName: string): string | null {
  const heading = screen.getByRole("heading", { name: laneName });
  return heading.parentElement?.querySelector("span")?.textContent ?? null;
}

function expectBoardUnmoved() {
  expect(keysIn("Backlog")).toEqual(["WEB-12 Retire the legacy tokens", "WEB-14 Trim the seed data"]);
  expect(keysIn("In Progress")).toEqual(["WEB-11 Rework the sign-in copy", "WEB-13 Audit the empty states"]);
  expect(laneCount("Backlog")).toBe("2");
  expect(laneCount("In Progress")).toBe("2");
}

function expectBoardMoved() {
  expect(keysIn("Backlog")).toEqual([
    "WEB-11 Rework the sign-in copy",
    "WEB-12 Retire the legacy tokens",
    "WEB-14 Trim the seed data",
  ]);
  expect(keysIn("In Progress")).toEqual(["WEB-13 Audit the empty states"]);
  expect(laneCount("Backlog")).toBe("3");
  expect(laneCount("In Progress")).toBe("1");
}

function toastMessages(): string[] {
  return showToastMock.mock.calls.map((call) => (call[0] as { message: string }).message);
}

describe("BoardScreen — a drop applies before the server answers (FR-041, FR-009)", () => {
  it("renders the card in its new lane and position while the call is still in flight", async () => {
    moveIssueMock.mockReturnValue(new Promise(() => {}));
    render(<BoardScreen board={BOARD} />);

    expectBoardUnmoved();
    await dragElevenIntoBacklog();

    await waitFor(() => expectBoardMoved());
    expect(showToastMock).not.toHaveBeenCalled();
  });

  it("names the issue, the target lane and the neighbour card, and carries no index", async () => {
    moveIssueMock.mockReturnValue(new Promise(() => {}));
    render(<BoardScreen board={BOARD} />);

    await dragElevenIntoBacklog();

    await waitFor(() => expect(moveIssueMock).toHaveBeenCalledTimes(1));
    expect(moveIssueMock).toHaveBeenCalledWith({
      issueId: WEB_11.id,
      grouping: "column",
      laneId: BACKLOG,
      targetIssueId: WEB_12.id,
      placement: "before",
    });
  });

  it("leaves the card in its new position once the move is accepted", async () => {
    moveIssueMock.mockResolvedValue({ ok: true });
    render(<BoardScreen board={BOARD} />);

    await dragElevenIntoBacklog();

    await waitFor(() => expect(moveIssueMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expectBoardMoved());
    expect(showToastMock).not.toHaveBeenCalled();
  });
});

describe("BoardScreen — a second drop of the same card (FR-041)", () => {
  const BACKLOG_AFTER_SECOND_DROP = [
    "WEB-12 Retire the legacy tokens",
    "WEB-14 Trim the seed data",
    "WEB-11 Rework the sign-in copy",
  ];

  it("keeps the second drop's position when the superseded first drop is refused", async () => {
    let refuseTheFirstDrop: (state: MoveIssueState) => void = () => {};
    moveIssueMock.mockReturnValueOnce(
      new Promise((resolve) => {
        refuseTheFirstDrop = resolve;
      }),
    );
    moveIssueMock.mockReturnValue(new Promise(() => {}));
    render(<BoardScreen board={BOARD} />);

    await dragElevenIntoBacklog();
    await waitFor(() => expectBoardMoved());

    await dragCardTo("WEB-11 Rework the sign-in copy", "Insert after WEB-14 Trim the seed data");
    await waitFor(() => expect(keysIn("Backlog")).toEqual(BACKLOG_AFTER_SECOND_DROP));

    await act(async () => {
      refuseTheFirstDrop({ ok: false, error: "invalid_target" });
    });

    expect(moveIssueMock).toHaveBeenCalledTimes(2);
    expect(keysIn("Backlog")).toEqual(BACKLOG_AFTER_SECOND_DROP);
    expect(keysIn("In Progress")).toEqual(["WEB-13 Audit the empty states"]);
    expect(showToastMock).not.toHaveBeenCalled();
  });
});

describe("BoardScreen — each refusal rolls back and says its own thing (FR-041, SC-010)", () => {
  const REFUSALS: [string, MoveIssueState, RegExp][] = [
    ["forbidden", { ok: false, error: "forbidden", reason: FORBIDDEN_REASON }, /Website Redesign/],
    ["not_found", { ok: false, error: "not_found" }, /gone/i],
    ["invalid_target", { ok: false, error: "invalid_target" }, /legal/i],
    ["no_index_available", { ok: false, error: "no_index_available" }, /between/i],
  ];

  it.each(REFUSALS)("returns the card to where it came from on %s", async (_name, state, pattern) => {
    moveIssueMock.mockResolvedValue(state);
    render(<BoardScreen board={BOARD} />);

    await dragElevenIntoBacklog();

    await waitFor(() => expect(showToastMock).toHaveBeenCalledTimes(1));
    expect(toastMessages()[0]).toMatch(pattern);
    expectBoardUnmoved();
  });

  it("carries the reason the mutator returned for a forbidden refusal", async () => {
    moveIssueMock.mockResolvedValue({ ok: false, error: "forbidden", reason: FORBIDDEN_REASON });
    render(<BoardScreen board={BOARD} />);

    await dragElevenIntoBacklog();

    await waitFor(() => expect(showToastMock).toHaveBeenCalledTimes(1));
    expect(toastMessages()[0]).toBe(FORBIDDEN_REASON);
  });

  it("refreshes the board only for not_found", async () => {
    moveIssueMock.mockResolvedValue({ ok: false, error: "invalid_target" });
    const { unmount } = render(<BoardScreen board={BOARD} />);

    await dragElevenIntoBacklog();
    await waitFor(() => expect(showToastMock).toHaveBeenCalledTimes(1));
    expect(refreshMock).not.toHaveBeenCalled();
    unmount();

    moveIssueMock.mockResolvedValue({ ok: false, error: "not_found" });
    render(<BoardScreen board={BOARD} />);

    await dragElevenIntoBacklog();
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("gives the four refusals four different messages and never one generic one", async () => {
    const messages: string[] = [];

    for (const [, state] of REFUSALS) {
      showToastMock.mockClear();
      moveIssueMock.mockResolvedValue(state);
      const { unmount } = render(<BoardScreen board={BOARD} />);

      await dragElevenIntoBacklog();
      await waitFor(() => expect(showToastMock).toHaveBeenCalledTimes(1));
      messages.push(toastMessages()[0] ?? "");
      unmount();
    }

    expect(new Set(messages).size).toBe(4);
  });
});

describe("BoardScreen — a call that never lands (FR-045, research D-7)", () => {
  it("names the connection, returns the card and queues nothing for later", async () => {
    moveIssueMock.mockRejectedValue(new Error("network"));
    render(<BoardScreen board={BOARD} />);

    await dragElevenIntoBacklog();

    await waitFor(() => expect(showToastMock).toHaveBeenCalledTimes(1));
    expect(toastMessages()[0]).toMatch(/connection/i);
    expectBoardUnmoved();

    await waitFor(() => expect(moveIssueMock).toHaveBeenCalledTimes(1));
    expect(moveIssueMock).toHaveBeenCalledTimes(1);
  });
});

describe("BoardScreen — an abandoned drag writes nothing (FR-042)", () => {
  it("writes nothing and returns the card when the drag is cancelled with Escape", async () => {
    moveIssueMock.mockReturnValue(new Promise(() => {}));
    render(<BoardScreen board={BOARD} />);

    await liftCard("WEB-11 Rework the sign-in copy");
    pressKey("Escape");

    expect(moveIssueMock).not.toHaveBeenCalled();
    expectBoardUnmoved();

    await dragElevenIntoBacklog();

    await waitFor(() => expect(moveIssueMock).toHaveBeenCalledTimes(1));
  });

  it("writes nothing and returns the card when the drop lands outside any lane", async () => {
    moveIssueMock.mockReturnValue(new Promise(() => {}));
    render(<BoardScreen board={BOARD} />);

    await liftCard("WEB-11 Rework the sign-in copy");
    fireEvent.drop(document.body);
    pressKey("Escape");

    expect(moveIssueMock).not.toHaveBeenCalled();
    expectBoardUnmoved();

    await dragElevenIntoBacklog();

    await waitFor(() => expect(moveIssueMock).toHaveBeenCalledTimes(1));
  });
});