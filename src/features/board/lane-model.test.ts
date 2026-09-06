import { describe, expect, it } from "vitest";
import {
  applyDrop,
  columnLanes,
  type Drop,
  type Grouping,
  type LaneBoard,
  type LanePriority,
  lanesFor,
  replayPendingMoves,
} from "./lane-model";

type TestCard = {
  id: string;
  columnId: string;
  order: number;
  assigneeId: string | null;
  priority: LanePriority;
};

function card(id: string, columnId: string, order: number, overrides: Partial<TestCard> = {}): TestCard {
  return { id, columnId, order, assigneeId: null, priority: "none", ...overrides };
}

const backlog = { id: "column-backlog", name: "Backlog" };
const todo = { id: "column-todo", name: "Todo" };
const done = { id: "column-done", name: "Done" };

describe("columnLanes (FR-016, FR-009, FR-022)", () => {
  it("filters the one project sequence per column and never re-sorts it", () => {
    const cards = [card("c", backlog.id, 5), card("a", todo.id, 1), card("b", backlog.id, 3)];

    const lanes = columnLanes(cards, [backlog, todo, done]);

    expect(lanes.map((lane) => lane.id)).toEqual([backlog.id, todo.id, done.id]);
    expect(lanes.map((lane) => lane.name)).toEqual(["Backlog", "Todo", "Done"]);
    expect(lanes[0]?.cards.map((entry) => entry.id)).toEqual(["c", "b"]);
    expect(lanes[1]?.cards.map((entry) => entry.id)).toEqual(["a"]);
    expect(lanes[2]?.cards).toEqual([]);
  });

  it("gives each lane exactly the cards it holds", () => {
    const cards = [card("a", backlog.id, 0), card("b", backlog.id, 1), card("c", todo.id, 2)];

    const lanes = columnLanes(cards, [backlog, todo, done]);

    expect(lanes.map((lane) => lane.cards.length)).toEqual([2, 1, 0]);
  });

  it("puts every card in exactly one lane, including one with no assignee and no priority", () => {
    const cards = [
      card("a", backlog.id, 0),
      card("b", todo.id, 1, { assigneeId: "user-1", priority: "high" }),
      card("c", done.id, 2),
      card("d", backlog.id, 3),
    ];

    const lanes = columnLanes(cards, [backlog, todo, done]);
    const placed = lanes.flatMap((lane) => lane.cards.map((entry) => entry.id));

    expect(placed.sort()).toEqual(["a", "b", "c", "d"]);
    expect(placed).toHaveLength(new Set(placed).size);
    expect(lanes.flatMap((lane) => lane.cards)).toContainEqual(cards[0]);
  });
});

describe("applyDrop (FR-031, FR-032, SC-003)", () => {
  const sequence = [
    card("a", backlog.id, 0),
    card("b", todo.id, 1),
    card("c", backlog.id, 2),
    card("d", todo.id, 3),
    card("e", backlog.id, 4),
  ];

  function laneOrder(cards: readonly TestCard[], columnId: string): string[] {
    return columnLanes(cards, [backlog, todo, done])
      .filter((lane) => lane.id === columnId)
      .flatMap((lane) => lane.cards.map((entry) => entry.id));
  }

  it("reinserts the moved card before a card in its own lane", () => {
    const moved = applyDrop(
      sequence,
      {
        issueId: "e",
        laneId: backlog.id,
        targetIssueId: "c",
        placement: "before",
      },
      "column",
    );

    expect(laneOrder(moved, backlog.id)).toEqual(["a", "e", "c"]);
    expect(laneOrder(moved, todo.id)).toEqual(["b", "d"]);
  });

  it("reinserts the moved card after a card in its own lane", () => {
    const moved = applyDrop(
      sequence,
      {
        issueId: "a",
        laneId: backlog.id,
        targetIssueId: "c",
        placement: "after",
      },
      "column",
    );

    expect(laneOrder(moved, backlog.id)).toEqual(["c", "a", "e"]);
  });

  it("moves a card into another lane before the card it was dropped on", () => {
    const moved = applyDrop(
      sequence,
      {
        issueId: "b",
        laneId: backlog.id,
        targetIssueId: "c",
        placement: "before",
      },
      "column",
    );

    expect(laneOrder(moved, backlog.id)).toEqual(["a", "b", "c", "e"]);
    expect(laneOrder(moved, todo.id)).toEqual(["d"]);
    expect(moved.find((entry) => entry.id === "b")?.columnId).toBe(backlog.id);
  });

  it("puts a drop with no target card at the lane's head under before", () => {
    const moved = applyDrop(
      sequence,
      {
        issueId: "d",
        laneId: backlog.id,
        targetIssueId: null,
        placement: "before",
      },
      "column",
    );

    expect(laneOrder(moved, backlog.id)).toEqual(["d", "a", "c", "e"]);
    expect(laneOrder(moved, todo.id)).toEqual(["b"]);
  });

  it("puts a drop with no target card at the lane's foot under after", () => {
    const moved = applyDrop(
      sequence,
      {
        issueId: "b",
        laneId: backlog.id,
        targetIssueId: null,
        placement: "after",
      },
      "column",
    );

    expect(laneOrder(moved, backlog.id)).toEqual(["a", "c", "e", "b"]);
  });

  it("is the lane's only card after a drop into an empty lane", () => {
    const moved = applyDrop(
      sequence,
      {
        issueId: "c",
        laneId: done.id,
        targetIssueId: null,
        placement: "after",
      },
      "column",
    );

    expect(laneOrder(moved, done.id)).toEqual(["c"]);
    expect(laneOrder(moved, backlog.id)).toEqual(["a", "e"]);
    expect(moved.find((entry) => entry.id === "c")?.columnId).toBe(done.id);
  });

  it("leaves the sequence as it was when the drop resolves to the position the card holds", () => {
    const beforeItsFollower = applyDrop(
      sequence,
      {
        issueId: "c",
        laneId: backlog.id,
        targetIssueId: "e",
        placement: "before",
      },
      "column",
    );
    const headOfItsOwnLane = applyDrop(
      sequence,
      {
        issueId: "a",
        laneId: backlog.id,
        targetIssueId: null,
        placement: "before",
      },
      "column",
    );

    expect(beforeItsFollower).toEqual([...sequence]);
    expect(headOfItsOwnLane).toEqual([...sequence]);
  });

  it("leaves the sequence as it was for an abandoned drop", () => {
    const unknownIssue = applyDrop(
      sequence,
      {
        issueId: "missing",
        laneId: backlog.id,
        targetIssueId: "c",
        placement: "before",
      },
      "column",
    );
    const targetOutsideTheLane = applyDrop(
      sequence,
      {
        issueId: "a",
        laneId: backlog.id,
        targetIssueId: "b",
        placement: "before",
      },
      "column",
    );
    const targetNoLaneHolds = applyDrop(
      sequence,
      {
        issueId: "a",
        laneId: backlog.id,
        targetIssueId: "missing",
        placement: "after",
      },
      "column",
    );

    expect(unknownIssue).toEqual([...sequence]);
    expect(targetOutsideTheLane).toEqual([...sequence]);
    expect(targetNoLaneHolds).toEqual([...sequence]);
  });

  it("never mutates its inputs", () => {
    const frozen = Object.freeze(sequence.map((entry) => Object.freeze({ ...entry })));

    const moved = applyDrop(
      frozen,
      {
        issueId: "b",
        laneId: backlog.id,
        targetIssueId: "e",
        placement: "after",
      },
      "column",
    );

    expect(moved).not.toBe(frozen);
    expect(frozen.map((entry) => entry.id)).toEqual(["a", "b", "c", "d", "e"]);
    expect(frozen.map((entry) => entry.columnId)).toEqual([
      backlog.id,
      todo.id,
      backlog.id,
      todo.id,
      backlog.id,
    ]);
    expect(laneOrder(moved, backlog.id)).toEqual(["a", "c", "e", "b"]);
  });

  it("ranks the cards it returns by their new position", () => {
    const moved = applyDrop(
      sequence,
      {
        issueId: "e",
        laneId: todo.id,
        targetIssueId: "b",
        placement: "after",
      },
      "column",
    );

    expect(moved.map((entry) => entry.order)).toEqual([0, 1, 2, 3, 4]);
  });
});
describe("applyDrop under Assignee and Priority grouping (FR-041, FR-021, FR-055, FR-056)", () => {
  const zoeAdams = "user-zoe";
  const annWard = "user-ann";

  const grouped = [
    card("a", backlog.id, 0, { priority: "low" }),
    card("b", todo.id, 1, { assigneeId: zoeAdams }),
    card("c", backlog.id, 2, { assigneeId: annWard, priority: "low" }),
    card("d", todo.id, 3, { assigneeId: annWard, priority: "high" }),
  ];

  it("moves a card into the lane of the person it was dropped on, before that card", () => {
    const moved = applyDrop(
      grouped,
      { issueId: "b", laneId: annWard, targetIssueId: "c", placement: "before" },
      "assignee",
    );

    expect(moved.find((entry) => entry.id === "b")?.assigneeId).toBe(annWard);
    expect(moved.filter((entry) => entry.assigneeId === annWard).map((entry) => entry.id)).toEqual([
      "b",
      "c",
      "d",
    ]);
    expect(moved.find((entry) => entry.id === "b")?.columnId).toBe(todo.id);
  });

  it("clears the assignee for a drop into the Unassigned lane", () => {
    const moved = applyDrop(
      grouped,
      { issueId: "d", laneId: "unassigned", targetIssueId: "a", placement: "after" },
      "assignee",
    );

    expect(moved.find((entry) => entry.id === "d")?.assigneeId).toBeNull();
    expect(moved.filter((entry) => entry.assigneeId === null).map((entry) => entry.id)).toEqual(["a", "d"]);
  });

  it("writes the priority of the empty lane a card is dropped into, and leaves its column alone", () => {
    const moved = applyDrop(
      grouped,
      { issueId: "a", laneId: "urgent", targetIssueId: null, placement: "after" },
      "priority",
    );

    expect(moved.find((entry) => entry.id === "a")?.priority).toBe("urgent");
    expect(moved.find((entry) => entry.id === "a")?.columnId).toBe(backlog.id);
    expect(moved.filter((entry) => entry.priority === "urgent").map((entry) => entry.id)).toEqual(["a"]);
  });
});
describe("lanesFor (FR-017, FR-018, FR-019, FR-021, FR-037)", () => {
  const zoeAdams = { id: "user-zoe", firstName: "Zoe", lastName: "Adams" };
  const annWard = { id: "user-ann", firstName: "Ann", lastName: "Ward" };
  const moBrown = { id: "user-mo", firstName: "Mo", lastName: "Brown" };
  const ivyVance = { id: "user-ivy", firstName: "Ivy", lastName: "Vance" };

  const cards = [
    card("a", backlog.id, 0),
    card("b", todo.id, 1, { assigneeId: zoeAdams.id, priority: "urgent" }),
    card("c", backlog.id, 2, { assigneeId: annWard.id, priority: "low" }),
    card("d", done.id, 3, { assigneeId: moBrown.id, priority: "high" }),
    card("e", todo.id, 4, { assigneeId: ivyVance.id, priority: "medium" }),
    card("f", backlog.id, 5, { assigneeId: zoeAdams.id }),
  ];

  const board: LaneBoard<TestCard> = {
    columns: [backlog, todo, done],
    cards,
    assigneePool: [zoeAdams, annWard],
    assignedOutsidePool: [moBrown, ivyVance],
  };

  it("returns the column lanes in board order under column grouping", () => {
    const lanes = lanesFor("column", board);

    expect(lanes.map((lane) => lane.id)).toEqual([backlog.id, todo.id, done.id]);
    expect(lanes.map((lane) => lane.name)).toEqual(["Backlog", "Todo", "Done"]);
    expect(lanes.map((lane) => lane.cards.map((entry) => entry.id))).toEqual([
      ["a", "c", "f"],
      ["b", "e"],
      ["d"],
    ]);
    expect(lanes.every((lane) => lane.canAcceptDrop)).toBe(true);
  });

  it("returns exactly five priority lanes, each holding the issues its own priority names", () => {
    const lanes = lanesFor("priority", board);

    expect(lanes).toHaveLength(5);
    expect(lanes.map((lane) => lane.id)).toEqual(["urgent", "high", "medium", "low", "none"]);
    expect(lanes.map((lane) => lane.name)).toEqual(["Urgent", "High", "Medium", "Low", "No priority"]);
    expect(lanes.map((lane) => lane.cards.map((entry) => entry.id))).toEqual([
      ["b"],
      ["d"],
      ["e"],
      ["c"],
      ["a", "f"],
    ]);
    expect(lanes.every((lane) => lane.canAcceptDrop)).toBe(true);
  });

  it("puts Unassigned first, then the pool, then the still-assigned people outside it", () => {
    const lanes = lanesFor("assignee", board);

    expect(lanes.map((lane) => lane.id)).toEqual([null, zoeAdams.id, annWard.id, moBrown.id, ivyVance.id]);
    expect(lanes.map((lane) => lane.name)).toEqual([
      "Unassigned",
      "Zoe Adams",
      "Ann Ward",
      "Mo Brown",
      "Ivy Vance",
    ]);
    expect(lanes.map((lane) => lane.cards.map((entry) => entry.id))).toEqual([
      ["a"],
      ["b", "f"],
      ["c"],
      ["d"],
      ["e"],
    ]);
  });

  it("keeps the pool's own ordering rather than re-sorting people by their rendered name", () => {
    const lanes = lanesFor("assignee", board);
    const people = lanes.slice(1).map((lane) => lane.name);

    expect(people).not.toEqual([...people].sort());
  });

  it("renders the people outside the pool as their own block, never interleaved with it", () => {
    const lanes = lanesFor("assignee", board);
    const droppable = lanes.filter((lane) => lane.canAcceptDrop).map((lane) => lane.id);
    const refused = lanes.filter((lane) => !lane.canAcceptDrop).map((lane) => lane.id);

    expect(droppable).toEqual([null, zoeAdams.id, annWard.id]);
    expect(refused).toEqual([moBrown.id, ivyVance.id]);
    expect(lanes.findIndex((lane) => lane.id === moBrown.id)).toBeGreaterThan(
      lanes.findIndex((lane) => lane.id === annWard.id),
    );
  });

  it("gives every person exactly one lane", () => {
    const lanes = lanesFor("assignee", board);
    const people = lanes.map((lane) => lane.id).filter((id) => id !== null);

    expect(people).toHaveLength(new Set(people).size);
    expect(people).toHaveLength(board.assigneePool.length + board.assignedOutsidePool.length);
  });

  it("puts every card in exactly one lane under every grouping", () => {
    const groupings: Grouping[] = ["column", "assignee", "priority"];

    for (const grouping of groupings) {
      const placed = lanesFor(grouping, board).flatMap((lane) => lane.cards.map((entry) => entry.id));

      expect([...placed].sort()).toEqual(["a", "b", "c", "d", "e", "f"]);
      expect(placed).toHaveLength(new Set(placed).size);
    }
  });
});
describe("replayPendingMoves (FR-055, FR-056, FR-059)", () => {
  const backlogFirst = card("a", backlog.id, 0);
  const stale = [
    backlogFirst,
    card("b", todo.id, 1),
    card("c", backlog.id, 2),
    card("d", todo.id, 3),
    card("e", backlog.id, 4),
  ];

  function laneOrder(cards: readonly TestCard[], columnId: string): string[] {
    return columnLanes(cards, [backlog, todo, done])
      .filter((lane) => lane.id === columnId)
      .flatMap((lane) => lane.cards.map((entry) => entry.id));
  }

  function pending(drops: Drop[]): ReadonlyMap<string, Drop> {
    return new Map(drops.map((drop) => [drop.issueId, drop]));
  }

  it("applies every in-flight drop over the newest server rows", () => {
    const replayed = replayPendingMoves(
      stale,
      pending([
        { issueId: "e", laneId: backlog.id, targetIssueId: "a", placement: "before" },
        { issueId: "b", laneId: done.id, targetIssueId: null, placement: "after" },
      ]),
      "column",
    );

    expect(laneOrder(replayed, backlog.id)).toEqual(["e", "a", "c"]);
    expect(laneOrder(replayed, todo.id)).toEqual(["d"]);
    expect(laneOrder(replayed, done.id)).toEqual(["b"]);
  });

  it("keeps the caller's optimistic position when the re-query carries older data", () => {
    const drop: Drop = { issueId: "b", laneId: backlog.id, targetIssueId: "a", placement: "after" };

    const replayed = replayPendingMoves(stale, pending([drop]), "column");

    expect(laneOrder(replayed, backlog.id)).toEqual(["a", "b", "c", "e"]);
    expect(replayed.find((entry) => entry.id === "b")?.columnId).toBe(backlog.id);
  });

  it("resolves the drop against the fresh neighbours rather than the ones it was made against", () => {
    const fresh = [
      card("f", backlog.id, 0),
      backlogFirst,
      card("b", todo.id, 2),
      card("c", backlog.id, 3),
      card("d", todo.id, 4),
      card("e", backlog.id, 5),
    ];

    const replayed = replayPendingMoves(
      fresh,
      pending([{ issueId: "e", laneId: backlog.id, targetIssueId: "f", placement: "after" }]),
      "column",
    );

    expect(laneOrder(replayed, backlog.id)).toEqual(["f", "e", "a", "c"]);
  });

  it("discards a pending move whose card the re-query no longer carries, and replays the rest", () => {
    const withoutE = stale.filter((entry) => entry.id !== "e");

    const replayed = replayPendingMoves(
      withoutE,
      pending([
        { issueId: "e", laneId: todo.id, targetIssueId: null, placement: "before" },
        { issueId: "b", laneId: backlog.id, targetIssueId: "a", placement: "before" },
      ]),
      "column",
    );

    expect(replayed.map((entry) => entry.id).sort()).toEqual(["a", "b", "c", "d"]);
    expect(laneOrder(replayed, backlog.id)).toEqual(["b", "a", "c"]);
    expect(laneOrder(replayed, todo.id)).toEqual(["d"]);
  });

  it("replays to an identical result when the re-query carries unchanged data", () => {
    const nothingInFlight = replayPendingMoves(stale, pending([]), "column");
    const alreadyServed = replayPendingMoves(
      stale,
      pending([{ issueId: "c", laneId: backlog.id, targetIssueId: "e", placement: "before" }]),
      "column",
    );

    expect(nothingInFlight).toEqual([...stale]);
    expect(alreadyServed).toEqual([...stale]);
  });

  it("never mutates its inputs", () => {
    const frozen = Object.freeze(stale.map((entry) => Object.freeze({ ...entry })));
    const moves = pending([{ issueId: "e", laneId: todo.id, targetIssueId: "b", placement: "before" }]);

    const replayed = replayPendingMoves(frozen, moves, "column");

    expect(replayed).not.toBe(frozen);
    expect(frozen.map((entry) => entry.id)).toEqual(["a", "b", "c", "d", "e"]);
    expect(frozen.map((entry) => entry.columnId)).toEqual([
      backlog.id,
      todo.id,
      backlog.id,
      todo.id,
      backlog.id,
    ]);
    expect(moves.size).toBe(1);
    expect(laneOrder(replayed, todo.id)).toEqual(["e", "b", "d"]);
  });
});