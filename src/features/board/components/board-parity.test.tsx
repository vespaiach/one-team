import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { BoardCard, BoardPerson, BoardView } from "../server/board-queries";
import { BoardScreen } from "./board-screen";

vi.mock("@/features/issues/actions", () => ({
  moveIssue: vi.fn(),
  createBoardCard: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
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
const MALLORY: BoardPerson = {
  id: "0198d2b1-0000-7000-8000-0000000000a2",
  firstName: "Mallory",
  lastName: "Kent",
  avatarUrl: null,
};

const WRITE_REASON = "Only project members can edit issues in Website Redesign.";

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

const CARDS = [
  card(11, IN_PROGRESS, 0, { assigneeId: GRACE.id, priority: "high" }),
  card(12, BACKLOG, 1, { assigneeId: MALLORY.id, priority: "low" }),
  card(13, IN_PROGRESS, 2),
  card(14, BACKLOG, 3, { priority: "high" }),
];

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
  cards: CARDS,
  assigneePool: [GRACE],
  assignedOutsidePool: [MALLORY],
  canWrite: true,
  writeReason: "",
};

const GROUPINGS = ["Column", "Assignee", "Priority"];

function Header({ control }: { control?: ReactNode }) {
  return <div data-region="header">{control}</div>;
}

function renderBoard(canWrite: boolean) {
  return render(
    <BoardScreen board={{ ...BOARD, canWrite, writeReason: canWrite ? "" : WRITE_REASON }}>
      <Header />
    </BoardScreen>,
  );
}

function pressKey(key: string) {
  const target = document.activeElement ?? document.body;
  fireEvent.keyDown(target, { key });
  fireEvent.keyUp(target, { key });
}

function groupBy(): HTMLElement {
  return screen.getByRole("button", { name: /Group by/ });
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

type LaneStructure = {
  name: string;
  count: string;
  cards: string[];
  emptyLine: string | null;
};

function laneStructures(container: HTMLElement): LaneStructure[] {
  return [...container.querySelectorAll<HTMLElement>('[data-region="lane"]')].map((lane) => {
    const scope = within(lane);
    const heading = scope.getByRole("heading");
    return {
      name: heading.textContent ?? "",
      count: heading.nextElementSibling?.textContent ?? "",
      cards: within(scope.getByRole("grid"))
        .queryAllByRole("row")
        .map((row) => row.getAttribute("aria-label"))
        .filter((name): name is string => name !== null),
      emptyLine: scope.queryByText("No cards")?.textContent ?? null,
    };
  });
}

function composersDisabled(container: HTMLElement): boolean[] {
  return [...container.querySelectorAll<HTMLElement>('[data-region="lane"]')].map((lane) =>
    within(lane).getByRole("textbox").hasAttribute("disabled"),
  );
}

async function structureUnder(canWrite: boolean, grouping: string): Promise<LaneStructure[]> {
  const view = renderBoard(canWrite);
  if (grouping !== "Column") {
    await chooseGrouping(grouping);
  }
  const structures = laneStructures(view.container);
  view.unmount();
  return structures;
}

describe("BoardScreen — a non-member's board is structurally identical to a member's (FR-002, SC-012, US6 sc.1)", () => {
  it.each(
    GROUPINGS,
  )("renders the same lanes, cards, counts and empty-lane lines under %s grouping", async (grouping) => {
    const memberStructure = await structureUnder(true, grouping);
    const nonMemberStructure = await structureUnder(false, grouping);

    expect(nonMemberStructure).toEqual(memberStructure);
    expect(memberStructure.length).toBeGreaterThan(0);
  });

  it("renders an empty lane's line for a non-member exactly as for a member", async () => {
    const memberDone = (await structureUnder(true, "Column")).find((lane) => lane.name === "Done");
    const nonMemberDone = (await structureUnder(false, "Column")).find((lane) => lane.name === "Done");

    expect(memberDone).toEqual({ name: "Done", count: "0", cards: [], emptyLine: "No cards" });
    expect(nonMemberDone).toEqual(memberDone);
  });

  it("gives an assigned non-member's card a lane of its own, named, for either viewer (US6 sc.6)", async () => {
    const memberLanes = await structureUnder(true, "Assignee");
    const nonMemberLanes = await structureUnder(false, "Assignee");

    const laneOf = (lanes: LaneStructure[]) => lanes.find((lane) => lane.name === "Mallory Kent");
    expect(laneOf(memberLanes)?.cards).toEqual(["WEB-12 Issue number 12"]);
    expect(laneOf(nonMemberLanes)).toEqual(laneOf(memberLanes));
  });
});

describe("BoardScreen — nothing implies a hidden-access state (FR-069, US6 sc.7)", () => {
  it.each(GROUPINGS)("renders every card the board holds under %s grouping", async (grouping) => {
    const nonMemberStructure = await structureUnder(false, grouping);

    const rendered = nonMemberStructure.flatMap((lane) => lane.cards).sort();
    expect(rendered).toEqual(CARDS.map((each) => `${each.key} ${each.title}`).sort());
  });

  it("counts every lane's rows exactly as the count it displays, for a non-member", async () => {
    const nonMemberStructure = await structureUnder(false, "Column");

    expect(nonMemberStructure.map((lane) => lane.count)).toEqual(
      nonMemberStructure.map((lane) => String(lane.cards.length)),
    );
  });
});

describe("BoardScreen — only affordances differ (FR-002, US6 sc.3)", () => {
  it("disables every composer for a non-member and none for a member, leaving the lanes equal", () => {
    const member = renderBoard(true);
    const memberDisabled = composersDisabled(member.container);
    const memberStructure = laneStructures(member.container);
    member.unmount();

    const nonMember = renderBoard(false);
    const nonMemberDisabled = composersDisabled(nonMember.container);
    const nonMemberStructure = laneStructures(nonMember.container);
    nonMember.unmount();

    expect(memberDisabled).toEqual(memberDisabled.map(() => false));
    expect(nonMemberDisabled).toEqual(memberDisabled.map(() => true));
    expect(nonMemberStructure).toEqual(memberStructure);
  });

  it("names the project in the reason on every one of a non-member's composers, hiding none", () => {
    const nonMember = renderBoard(false);
    const lanes = [...nonMember.container.querySelectorAll<HTMLElement>('[data-region="lane"]')];

    const names = lanes.map((lane) => within(lane).getByRole("textbox").getAttribute("aria-label"));
    nonMember.unmount();

    expect(names).toEqual(lanes.map(() => WRITE_REASON));
  });
});