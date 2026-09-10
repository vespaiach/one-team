import { displayName } from "@/lib/display-name";

export type OrderedCard = {
  order: number;
};

export type LaneCard = OrderedCard & {
  columnId: string;
};

export type LaneColumn = {
  id: string;
  name: string;
};

export type Lane<Card extends LaneCard> = {
  id: string;
  name: string;
  cards: Card[];
};

export function columnLanes<Card extends LaneCard>(
  cards: readonly Card[],
  columns: readonly LaneColumn[],
): Lane<Card>[] {
  return columns.map((column) => ({
    id: column.id,
    name: column.name,
    cards: cards.filter((card) => card.columnId === column.id),
  }));
}

export const UNASSIGNED_LANE_ID = "unassigned";

export type DropPlacement = "before" | "after";

export type Drop = {
  issueId: string;
  laneId: string;
  targetIssueId: string | null;
  placement: DropPlacement;
};

type DroppedCard = GroupedCard & { id: string };

function laneOf<Card extends GroupedCard>(grouping: Grouping, card: Card): string {
  if (grouping === "assignee") {
    return card.assigneeId ?? UNASSIGNED_LANE_ID;
  }
  if (grouping === "priority") {
    return card.priority;
  }
  return card.columnId;
}

function settleLane<Card extends GroupedCard>(grouping: Grouping, card: Card, laneId: string) {
  if (grouping === "assignee") {
    return { ...card, assigneeId: laneId === UNASSIGNED_LANE_ID ? null : laneId };
  }
  if (grouping === "priority") {
    return { ...card, priority: PRIORITY_LANES.find((lane) => lane.id === laneId)?.id ?? card.priority };
  }
  return { ...card, columnId: laneId };
}

function laneOrderAfterDrop<Card extends DroppedCard>(
  laneCards: readonly Card[],
  moved: Card,
  drop: Drop,
): Card[] {
  if (drop.targetIssueId === null) {
    const others = laneCards.filter((card) => card.id !== moved.id);
    return drop.placement === "before" ? [moved, ...others] : [...others, moved];
  }

  const reordered: Card[] = [];
  for (const card of laneCards) {
    if (card.id === drop.targetIssueId && drop.placement === "before") {
      reordered.push(moved);
    }
    if (card.id !== moved.id) {
      reordered.push(card);
    }
    if (card.id === drop.targetIssueId && drop.placement === "after") {
      reordered.push(moved);
    }
  }
  return reordered;
}

function insertionIndex<Card extends DroppedCard>(
  rest: readonly Card[],
  previous: Card | undefined,
  next: Card | undefined,
): number {
  if (previous) {
    return rest.findIndex((card) => card.id === previous.id) + 1;
  }
  if (next) {
    return rest.findIndex((card) => card.id === next.id);
  }
  return rest.length;
}

export function applyDrop<Card extends DroppedCard>(
  cards: readonly Card[],
  drop: Drop,
  grouping: Grouping,
): Card[] {
  const moved = cards.find((card) => card.id === drop.issueId);
  const laneCards = cards.filter((card) => laneOf(grouping, card) === drop.laneId);
  const targetIsInLane = laneCards.some((card) => card.id === drop.targetIssueId);
  if (!moved || (drop.targetIssueId !== null && !targetIsInLane)) {
    return [...cards];
  }

  const reordered = laneOrderAfterDrop(laneCards, moved, drop);
  const laneIndex = reordered.findIndex((card) => card.id === moved.id);
  const laneUnchanged = laneOf(grouping, moved) === drop.laneId;
  if (laneUnchanged && laneIndex === laneCards.findIndex((card) => card.id === moved.id)) {
    return [...cards];
  }

  const rest = cards.filter((card) => card.id !== moved.id);
  const insertAt = insertionIndex(rest, reordered[laneIndex - 1], reordered[laneIndex + 1]);
  const placed = laneUnchanged ? moved : settleLane(grouping, moved, drop.laneId);
  return [...rest.slice(0, insertAt), placed, ...rest.slice(insertAt)].map((card, index) => ({
    ...card,
    order: index,
  }));
}
export function replayPendingMoves<Card extends DroppedCard>(
  freshCards: readonly Card[],
  pendingMoves: ReadonlyMap<string, Drop>,
  grouping: Grouping,
): Card[] {
  let replayed: Card[] = [...freshCards];
  for (const drop of pendingMoves.values()) {
    replayed = applyDrop(replayed, drop, grouping);
  }
  return replayed;
}

export type Grouping = "column" | "assignee" | "priority";

export type LanePriority = "urgent" | "high" | "medium" | "low" | "none";

export type LanePerson = {
  id: string;
  firstName: string;
  lastName: string;
};

export type GroupedCard = LaneCard & {
  assigneeId: string | null;
  priority: LanePriority;
};

export type GroupedLane<Card extends GroupedCard> = {
  id: string | null;
  name: string;
  cards: Card[];
  canAcceptDrop: boolean;
};

export type LaneBoard<Card extends GroupedCard> = {
  columns: readonly LaneColumn[];
  cards: readonly Card[];
  assigneePool: readonly LanePerson[];
  assignedOutsidePool: readonly LanePerson[];
};

const PRIORITY_LANES: { id: LanePriority; name: string }[] = [
  { id: "urgent", name: "Urgent" },
  { id: "high", name: "High" },
  { id: "medium", name: "Medium" },
  { id: "low", name: "Low" },
  { id: "none", name: "No priority" },
];

function personLane<Card extends GroupedCard>(
  person: LanePerson,
  cards: readonly Card[],
  canAcceptDrop: boolean,
): GroupedLane<Card> {
  return {
    id: person.id,
    name: displayName(person),
    cards: cards.filter((card) => card.assigneeId === person.id),
    canAcceptDrop,
  };
}

function assigneeLanes<Card extends GroupedCard>(board: LaneBoard<Card>): GroupedLane<Card>[] {
  return [
    {
      id: null,
      name: "Unassigned",
      cards: board.cards.filter((card) => card.assigneeId === null),
      canAcceptDrop: true,
    },
    ...board.assigneePool.map((person) => personLane(person, board.cards, true)),
    ...board.assignedOutsidePool.map((person) => personLane(person, board.cards, false)),
  ];
}

export function lanesFor<Card extends GroupedCard>(
  grouping: Grouping,
  board: LaneBoard<Card>,
): GroupedLane<Card>[] {
  if (grouping === "assignee") {
    return assigneeLanes(board);
  }
  if (grouping === "priority") {
    return PRIORITY_LANES.map((lane) => ({
      id: lane.id,
      name: lane.name,
      cards: board.cards.filter((card) => card.priority === lane.id),
      canAcceptDrop: true,
    }));
  }
  return columnLanes(board.cards, board.columns).map((lane) => ({ ...lane, canAcceptDrop: true }));
}

export function filterByAssignee<Card extends { assigneeId: string | null }>(
  cards: readonly Card[],
  assigneeId: string | null,
): readonly Card[] {
  if (assigneeId === null) {
    return cards;
  }
  return cards.filter((card) => card.assigneeId === assigneeId);
}