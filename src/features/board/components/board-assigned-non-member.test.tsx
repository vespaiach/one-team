import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MoveIssuePayload, MoveIssueState } from "@/features/issues/actions";
import { buildIssueWriteReason } from "@/features/issues/server/issue-queries";
import type { BoardCard, BoardPerson, BoardView } from "../server/board-queries";
import { BoardScreen } from "./board-screen";

const moveIssueMock = vi.fn<(input: MoveIssuePayload) => Promise<MoveIssueState>>();
vi.mock("@/features/issues/actions", () => ({
  moveIssue: (input: MoveIssuePayload) => moveIssueMock(input),
  createBoardCard: vi.fn(),
}));

vi.mock("@/features/shell/components/toast-region", () => ({ showToast: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const BACKLOG = "0198d2b1-0000-7000-8000-0000000000c1";
const IN_PROGRESS = "0198d2b1-0000-7000-8000-0000000000c2";

const GRACE: BoardPerson = {
  id: "0198d2b1-0000-7000-8000-0000000000a1",
  firstName: "Grace",
  lastName: "Hopper",
  avatarUrl: null,
};

const MALLORY: BoardPerson = {
  id: "0198d2b1-0000-7000-8000-0000000000a2",
  firstName: "Mallory",
  lastName: "Kent",
  avatarUrl: null,
};

const REASON = "Only project members can edit issues in Website Redesign.";

function card(number: number, title: string, columnId: string, order: number, assignee: BoardPerson | null) {
  return {
    id: `0198d2b1-0000-7000-8000-00000000${String(number).padStart(4, "0")}`,
    key: `WEB-${number}`,
    title,
    columnId,
    assigneeId: assignee?.id ?? null,
    priority: "none",
    dueDate: null,
    labels: [],
    assignee,
    commentCount: 0,
    order,
  } satisfies BoardCard;
}

const THEIR_CARD = card(12, "Retire the legacy tokens", BACKLOG, 0, MALLORY);
const OTHER_CARD = card(11, "Rework the sign-in copy", IN_PROGRESS, 1, GRACE);

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
  ],
  cards: [THEIR_CARD, OTHER_CARD],
  assigneePool: [GRACE],
  assignedOutsidePool: [MALLORY],
  canWrite: false,
  writeReason: REASON,
};

beforeEach(() => {
  moveIssueMock.mockReset();
});

function pressKey(key: string) {
  const target = document.activeElement ?? document.body;
  fireEvent.keyDown(target, { key });
  fireEvent.keyUp(target, { key });
}

async function chooseAssigneeGrouping() {
  const button = screen.getByRole("button", { name: /Group by/ });
  button.focus();
  fireEvent.keyDown(button, { key: "ArrowDown" });
  fireEvent.keyUp(button, { key: "ArrowDown" });
  await screen.findByRole("listbox");
  pressKey("Home");
  for (let step = 0; step < 3 && document.activeElement?.textContent !== "Assignee"; step += 1) {
    pressKey("ArrowDown");
  }
  pressKey("Enter");
  await waitFor(() => expect(screen.getByRole("button", { name: /Group by/ }).textContent).toBe("Assignee"));
}

function renderBoard() {
  return render(<BoardScreen board={BOARD} />);
}

function rowsIn(laneName: string): (string | null)[] {
  return within(screen.getByRole("grid", { name: laneName }))
    .queryAllByRole("row")
    .map((row) => row.getAttribute("aria-label"));
}

describe("BoardScreen — an assigned non-member's own card (FR-067, OT-AUTHZ-015, US6 sc.6)", () => {
  it("renders their card in its column, alongside everyone else's", () => {
    renderBoard();

    expect(rowsIn("Backlog")).toEqual(["WEB-12 Retire the legacy tokens"]);
    expect(rowsIn("In Progress")).toEqual(["WEB-11 Rework the sign-in copy"]);
  });

  it("gives them a lane of their own under Assignee grouping, named for them", async () => {
    renderBoard();

    await chooseAssigneeGrouping();

    expect(rowsIn("Mallory Kent")).toEqual(["WEB-12 Retire the legacy tokens"]);
  });

  it("offers no way to move it: no drag affordance anywhere, and no call made", async () => {
    renderBoard();

    expect(screen.queryAllByRole("button", { name: /^Drag / })).toEqual([]);

    const row = screen.getByRole("row", { name: "WEB-12 Retire the legacy tokens" });
    row.focus();
    fireEvent.keyDown(row, { key: "Enter" });
    fireEvent.keyUp(row, { key: "Enter" });

    await waitFor(() => expect(screen.queryAllByRole("button", { name: /^Drag / })).toEqual([]));
    expect(moveIssueMock).not.toHaveBeenCalled();
  });
});

describe("BoardScreen — the board names the project they would need to be added to (FR-067)", () => {
  it("names it in the reason on every lane's composer, in the project's own name", () => {
    const { container } = renderBoard();

    const composers = [...container.querySelectorAll<HTMLElement>('[data-region="lane"]')].map((lane) =>
      within(lane).getByRole("textbox"),
    );
    expect(composers.map((field) => field.getAttribute("placeholder"))).toEqual(composers.map(() => REASON));
    expect(screen.getAllByPlaceholderText(/Website Redesign/)).toHaveLength(composers.length);
  });

  it("names it in the reason on their own assignee lane too, rather than the pool wording", async () => {
    renderBoard();

    await chooseAssigneeGrouping();

    const lane = screen.getByRole("grid", { name: "Mallory Kent" }).closest('[data-region="lane"]');
    const scope = within(lane as HTMLElement);
    expect(scope.getByRole("textbox").getAttribute("aria-label")).toBe(REASON);
    expect(scope.getByRole("button", { name: REASON }).hasAttribute("disabled")).toBe(true);
  });

  it("uses the wording issue-queries already builds, not a second phrasing", () => {
    const { container } = renderBoard();

    const composer = within(container.querySelector('[data-region="lane"]') as HTMLElement).getByRole(
      "textbox",
    );
    expect(composer.getAttribute("aria-label")).toBe(buildIssueWriteReason("edit", BOARD.project.name));
  });
});