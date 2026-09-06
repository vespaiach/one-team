import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Actor } from "@/features/auth/server/actor";
import type { MoveIssuePayload, MoveIssueState } from "@/features/issues/actions";
import { resolveIssueWriteAccess } from "@/features/issues/server/issue-queries";
import type { BoardCard, BoardPerson, BoardView } from "../server/board-queries";
import { BoardScreen } from "./board-screen";

const moveIssueMock = vi.fn<(input: MoveIssuePayload) => Promise<MoveIssueState>>();
vi.mock("@/features/issues/actions", () => ({
  moveIssue: (input: MoveIssuePayload) => moveIssueMock(input),
  createBoardCard: vi.fn(),
}));

vi.mock("@/features/shell/components/toast-region", () => ({
  showToast: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

const hasProjectMemberRowMock = vi.fn<(projectId: string, userId: string) => Promise<boolean>>();
vi.mock("@/features/projects/server/queries", () => ({
  hasProjectMemberRow: (projectId: string, userId: string) => hasProjectMemberRowMock(projectId, userId),
}));

const PROJECT = { id: "0198d2b1-0000-7000-8000-0000000000p1", name: "Website Redesign" };
const BACKLOG = "0198d2b1-0000-7000-8000-0000000000c1";
const IN_PROGRESS = "0198d2b1-0000-7000-8000-0000000000c2";

const ZOE: BoardPerson = {
  id: "0198d2b1-0000-7000-8000-0000000000a1",
  firstName: "Zoe",
  lastName: "Adams",
  avatarUrl: null,
};
const ALAN: BoardPerson = {
  id: "0198d2b1-0000-7000-8000-0000000000a2",
  firstName: "Alan",
  lastName: "Turing",
  avatarUrl: null,
};

function actorFor(person: BoardPerson, role: string): Actor {
  return {
    id: person.id,
    role,
    firstName: person.firstName,
    lastName: person.lastName,
    avatarUrl: null,
    mustChangePassword: false,
  };
}

const ADMIN_WITHOUT_A_MEMBERSHIP_ROW = actorFor(ZOE, "admin");
const NON_MEMBER = actorFor(ALAN, "member");
const NOT_A_MEMBER_REASON = "Only project members can edit issues in Website Redesign.";

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

function boardFor(access: { canWrite: boolean; writeReason: string }): BoardView {
  return {
    project: { id: PROJECT.id, key: "WEB", name: PROJECT.name, status: "active" },
    columns: [
      { id: BACKLOG, name: "Backlog" },
      { id: IN_PROGRESS, name: "In Progress" },
    ],
    cards: [WEB_11, WEB_12],
    assigneePool: [ZOE],
    assignedOutsidePool: [],
    canWrite: access.canWrite,
    writeReason: access.writeReason,
  };
}

function Header({ control }: { control?: React.ReactNode }) {
  return <div data-region="header">{control}</div>;
}

async function renderBoardAs(actor: Actor) {
  const access = await resolveIssueWriteAccess(actor, PROJECT);
  render(
    <BoardScreen board={boardFor(access)}>
      <Header />
    </BoardScreen>,
  );
  return access;
}

function activeElement(): HTMLElement {
  return (document.activeElement ?? document.body) as HTMLElement;
}

function currentLabel(): string | null {
  return activeElement().getAttribute("aria-label");
}

function pressKey(key: string) {
  fireEvent.keyDown(activeElement(), { key });
  fireEvent.keyUp(activeElement(), { key });
}

async function chooseGrouping(name: string) {
  const button = screen.getByRole("button", { name: /Group by/ });
  button.focus();
  fireEvent.keyDown(button, { key: "ArrowDown" });
  fireEvent.keyUp(button, { key: "ArrowDown" });
  await screen.findByRole("listbox");
  pressKey("Home");
  for (let step = 0; step < 3 && activeElement().textContent !== name; step += 1) {
    pressKey("ArrowDown");
  }
  pressKey("Enter");
  await waitFor(() => expect(screen.getByRole("button", { name: /Group by/ }).textContent).toBe(name));
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

function focusedLaneName(): string | null {
  return activeElement().closest('[data-region="lane"]')?.querySelector("h2")?.textContent ?? null;
}

async function dragCardIntoEmptyLane(cardName: string, laneName: string) {
  await liftCard(cardName);
  for (let lane = 0; lane < 4; lane += 1) {
    for (let step = 0; step < 8; step += 1) {
      if (focusedLaneName() === laneName && currentLabel()?.startsWith("Drop on") === true) {
        pressKey("Enter");
        return;
      }
      pressKey("ArrowDown");
    }
    pressKey("Tab");
  }
  throw new Error(`never reached the ${laneName} lane — stopped at "${focusedLaneName()}"`);
}

function laneNames(): (string | null)[] {
  return screen.getAllByRole("grid").map((grid) => grid.getAttribute("aria-label"));
}

function composersNamed(name: string): HTMLElement[] {
  return screen.queryAllByRole("textbox", { name });
}

beforeEach(() => {
  moveIssueMock.mockReset();
  moveIssueMock.mockResolvedValue({ ok: true });
  hasProjectMemberRowMock.mockClear();
  hasProjectMemberRowMock.mockResolvedValue(false);
});

describe("The board's write access for an admin holding no membership row (FR-068, US6 sc.8)", () => {
  it("grants write without a project_member row, where the same board refuses a non-member by name", async () => {
    await expect(resolveIssueWriteAccess(ADMIN_WITHOUT_A_MEMBERSHIP_ROW, PROJECT)).resolves.toEqual({
      canWrite: true,
      writeReason: "",
    });
    await expect(resolveIssueWriteAccess(NON_MEMBER, PROJECT)).resolves.toEqual({
      canWrite: false,
      writeReason: NOT_A_MEMBER_REASON,
    });
  });
});

describe("BoardScreen — an admin holding no membership row composes as a member does (FR-068)", () => {
  it("enables every composer, naming none of them with a refusal", async () => {
    await renderBoardAs(ADMIN_WITHOUT_A_MEMBERSHIP_ROW);

    expect(composersNamed("Add a card")).toHaveLength(2);
    for (const field of composersNamed("Add a card")) {
      expect(field).toHaveProperty("disabled", false);
    }
    expect(composersNamed(NOT_A_MEMBER_REASON)).toHaveLength(0);
    expect(screen.queryByText(NOT_A_MEMBER_REASON)).toBeNull();
  });
});

describe("BoardScreen — an admin holding no membership row drags as a member does (FR-068)", () => {
  it("moves a card between columns and calls moveIssue for it", async () => {
    await renderBoardAs(ADMIN_WITHOUT_A_MEMBERSHIP_ROW);

    await dragCardTo(`${WEB_11.key} ${WEB_11.title}`, `Insert before ${WEB_12.key} ${WEB_12.title}`);

    await waitFor(() => expect(moveIssueMock).toHaveBeenCalledTimes(1));
    expect(moveIssueMock).toHaveBeenCalledWith({
      issueId: WEB_11.id,
      grouping: "column",
      laneId: BACKLOG,
      targetIssueId: WEB_12.id,
      placement: "before",
    });
  });
});

describe("BoardScreen — an admin has a lane of their own under Assignee grouping (FR-068)", () => {
  it("renders their lane though they hold no membership row and no card, and it accepts a drop", async () => {
    await renderBoardAs(ADMIN_WITHOUT_A_MEMBERSHIP_ROW);

    await chooseGrouping("Assignee");

    expect(laneNames()).toEqual(["Unassigned", "Zoe Adams"]);
    const lane = screen.getByRole("grid", { name: "Zoe Adams" });
    expect(within(lane).getByText("No cards")).not.toBeNull();

    await dragCardIntoEmptyLane(`${WEB_11.key} ${WEB_11.title}`, "Zoe Adams");

    await waitFor(() => expect(moveIssueMock).toHaveBeenCalledTimes(1));
    expect(moveIssueMock).toHaveBeenCalledWith({
      issueId: WEB_11.id,
      grouping: "assignee",
      laneId: ZOE.id,
      targetIssueId: null,
      placement: "after",
    });
  });

  it("leaves their lane's composer enabled rather than treating them as outside the assignee pool", async () => {
    await renderBoardAs(ADMIN_WITHOUT_A_MEMBERSHIP_ROW);

    await chooseGrouping("Assignee");

    const outsidePool = "Zoe Adams isn't in this project's assignee pool, so a card can't be added here.";
    expect(composersNamed(outsidePool)).toHaveLength(0);
    expect(composersNamed("Add a card")).toHaveLength(2);
  });
});