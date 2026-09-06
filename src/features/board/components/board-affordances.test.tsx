import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { isValidElement, type ReactElement, type ReactNode, Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MoveIssuePayload, MoveIssueState } from "@/features/issues/actions";
import { ProjectHeader } from "@/features/projects/components/project-header";
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
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock, push: pushMock }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  forbidden: () => {
    throw new Error("NEXT_FORBIDDEN");
  },
}));

vi.mock("@/features/auth/server/actor", () => ({ requireActor: vi.fn() }));
vi.mock("@/features/board/server/board-queries", () => ({ loadBoard: vi.fn() }));
vi.mock("@/features/activity/server/feed-queries", () => ({ countProjectComments: vi.fn() }));

import ProjectBoardPage from "@/app/(app)/projects/[projectKey]/page";
import { countProjectComments } from "@/features/activity/server/feed-queries";
import { requireActor } from "@/features/auth/server/actor";
import { loadBoard } from "../server/board-queries";

const BACKLOG = "0198d2b1-0000-7000-8000-0000000000c1";
const IN_PROGRESS = "0198d2b1-0000-7000-8000-0000000000c2";
const DONE = "0198d2b1-0000-7000-8000-0000000000c3";

const EDIT_REASON = "Only project members can edit issues in Website Redesign.";
const CREATE_REASON = "Only project members can create issues in Website Redesign.";
const MOVE_REASON = "Only project members can move issues in Website Redesign.";

const ACTOR = {
  id: "0198d2b1-0000-7000-8000-0000000000a1",
  role: "member" as const,
  firstName: "Ada",
  lastName: "Lovelace",
  avatarUrl: null,
  mustChangePassword: false,
};

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

const CARDS = [
  card(11, "Rework the sign-in copy", IN_PROGRESS, 0),
  card(12, "Retire the legacy tokens", BACKLOG, 1),
  card(13, "Audit the empty states", IN_PROGRESS, 2),
  card(14, "Trim the seed data", BACKLOG, 3),
];

function board(canWrite: boolean): BoardView {
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
    cards: CARDS,
    assigneePool: [],
    assignedOutsidePool: [],
    canWrite,
    writeReason: canWrite ? "" : EDIT_REASON,
  };
}

beforeEach(() => {
  moveIssueMock.mockReset();
  showToastMock.mockClear();
  refreshMock.mockClear();
  pushMock.mockClear();
  vi.mocked(requireActor).mockResolvedValue(ACTOR);
  vi.mocked(loadBoard).mockReset();
});

function lanes(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-region="lane"]')];
}

type LaneStructure = { name: string; count: string; cards: (string | null)[] };

function laneStructures(container: HTMLElement): LaneStructure[] {
  return lanes(container).map((lane) => {
    const scope = within(lane);
    const heading = scope.getByRole("heading");
    return {
      name: heading.textContent ?? "",
      count: heading.nextElementSibling?.textContent ?? "",
      cards: within(scope.getByRole("grid"))
        .queryAllByRole("row")
        .map((row) => row.getAttribute("aria-label")),
    };
  });
}

function dragHandles(): HTMLElement[] {
  return screen.queryAllByRole("button", { name: /^Drag / });
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

async function dragCardTo(cardName: string, indicatorLabel: string) {
  const handle = screen.getByRole("button", { name: `Drag ${cardName}` });
  handle.focus();
  fireEvent.keyDown(handle, { key: "Enter" });
  fireEvent.keyUp(handle, { key: "Enter" });
  await waitFor(() => expect(currentLabel()).toMatch(/^(Insert|Drop on)/));
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
    .queryAllByRole("row")
    .map((row) => row.getAttribute("aria-label"));
}

function elements(node: ReactNode): ReactElement<{ children?: ReactNode }>[] {
  if (Array.isArray(node)) {
    return node.flatMap(elements);
  }
  if (!isValidElement(node)) {
    return [];
  }
  const element = node as ReactElement<{ children?: ReactNode }>;
  return [element, ...elements(element.props.children)];
}

function headerOf(node: ReactNode): ReactElement<{ newIssue?: ReactNode }> | undefined {
  return elements(node).find((element) => element.type === ProjectHeader) as
    | ReactElement<{ newIssue?: ReactNode }>
    | undefined;
}

async function headerNewIssue(canWrite: boolean): Promise<ReactNode> {
  vi.mocked(loadBoard).mockResolvedValue(board(canWrite));
  vi.mocked(countProjectComments).mockResolvedValue(0);
  const jsx = await ProjectBoardPage({ params: Promise.resolve({ projectKey: "WEB" }) });
  const boundary = elements(jsx).find((element) => element.type === Suspense);
  const child = boundary?.props.children as ReactElement<Record<string, unknown>>;
  const renderBoardData = child.type as (props: Record<string, unknown>) => Promise<ReactNode>;
  return headerOf(await renderBoardData(child.props))?.props.newIssue;
}

describe("BoardScreen — a non-member's lanes receive no drag hooks (FR-065, US6 sc.2)", () => {
  it("gives a member a drag affordance on every card", () => {
    render(<BoardScreen board={board(true)} />);

    expect(dragHandles()).toHaveLength(CARDS.length);
  });

  it("gives a non-member none at all, so no drag can begin", () => {
    render(<BoardScreen board={board(false)} />);

    expect(dragHandles()).toEqual([]);
  });

  it("marks no row of a non-member's board draggable", () => {
    const { container } = render(<BoardScreen board={board(false)} />);

    expect(container.querySelectorAll('[draggable="true"]')).toHaveLength(0);
  });

  it("makes no call when a non-member presses Enter on a card", async () => {
    render(<BoardScreen board={board(false)} />);

    const row = screen.getByRole("row", { name: "WEB-11 Rework the sign-in copy" });
    row.focus();
    fireEvent.keyDown(row, { key: "Enter" });
    fireEvent.keyUp(row, { key: "Enter" });

    await waitFor(() => expect(dragHandles()).toEqual([]));
    expect(moveIssueMock).not.toHaveBeenCalled();
  });
});

describe("BoardScreen — every composer is disabled with its reason, none hidden (FR-052, US6 sc.3)", () => {
  it("renders one composer per lane for a non-member, every one disabled and naming the project", () => {
    const { container } = render(<BoardScreen board={board(false)} />);

    const composers = lanes(container).map((lane) => within(lane).getByRole("textbox"));
    expect(composers).toHaveLength(lanes(container).length);
    expect(composers.map((field) => field.hasAttribute("disabled"))).toEqual(composers.map(() => true));
    expect(composers.map((field) => field.getAttribute("aria-label"))).toEqual(
      composers.map(() => EDIT_REASON),
    );
    expect(composers.map((field) => field.getAttribute("placeholder"))).toEqual(
      composers.map(() => EDIT_REASON),
    );
  });

  it("renders the chevron beside each composer disabled, carrying the same reason, never hidden", () => {
    const { container } = render(<BoardScreen board={board(false)} />);

    const chevrons = lanes(container).map((lane) => within(lane).getByRole("button", { name: EDIT_REASON }));
    expect(chevrons).toHaveLength(lanes(container).length);
    expect(chevrons.map((button) => button.hasAttribute("disabled"))).toEqual(chevrons.map(() => true));
  });
});

describe("the board page — the header's New issue entry point (FR-005, FR-052, US6 sc.3)", () => {
  it("hands the header a New issue control at all", async () => {
    expect(await headerNewIssue(true)).toBeDefined();
  });

  it("points a member's control at this project's create-issue route", async () => {
    render(await headerNewIssue(true));

    expect(screen.getByRole("link", { name: "New issue" }).getAttribute("href")).toBe(
      "/projects/WEB/issues/new",
    );
  });

  it("renders a non-member's control disabled with the reason naming the project, not hidden", async () => {
    render(await headerNewIssue(false));

    const control = screen.getByRole("link", { name: "New issue" });
    expect(control.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByText(CREATE_REASON)).toBeDefined();
  });
});

describe("BoardScreen — membership removed while the board is open (FR-066, US6 sc.5)", () => {
  it("disables the controls on the next render, removing no card and changing nothing else", () => {
    const { container, rerender } = render(<BoardScreen board={board(true)} />);
    const before = laneStructures(container);

    rerender(<BoardScreen board={board(false)} />);

    expect(laneStructures(container)).toEqual(before);
    expect(dragHandles()).toEqual([]);
    const composers = lanes(container).map((lane) => within(lane).getByRole("textbox"));
    expect(composers.map((field) => field.getAttribute("aria-label"))).toEqual(
      composers.map(() => EDIT_REASON),
    );
    expect(composers.map((field) => field.hasAttribute("disabled"))).toEqual(composers.map(() => true));
  });

  it("refuses an in-flight drop and rolls it back to where it came from", async () => {
    let settle: (state: MoveIssueState) => void = () => {};
    moveIssueMock.mockReturnValue(
      new Promise<MoveIssueState>((resolve) => {
        settle = resolve;
      }),
    );
    const { rerender } = render(<BoardScreen board={board(true)} />);

    await dragCardTo("WEB-11 Rework the sign-in copy", "Insert before WEB-12 Retire the legacy tokens");
    await waitFor(() =>
      expect(keysIn("Backlog")).toEqual([
        "WEB-11 Rework the sign-in copy",
        "WEB-12 Retire the legacy tokens",
        "WEB-14 Trim the seed data",
      ]),
    );

    rerender(<BoardScreen board={board(false)} />);
    settle({ ok: false, error: "forbidden", reason: MOVE_REASON });

    await waitFor(() => expect(showToastMock).toHaveBeenCalledTimes(1));
    expect(keysIn("Backlog")).toEqual(["WEB-12 Retire the legacy tokens", "WEB-14 Trim the seed data"]);
    expect(keysIn("In Progress")).toEqual([
      "WEB-11 Rework the sign-in copy",
      "WEB-13 Audit the empty states",
    ]);
    expect(showToastMock.mock.calls.map((call) => (call[0] as { message: string }).message)).toEqual([
      MOVE_REASON,
    ]);
  });
});