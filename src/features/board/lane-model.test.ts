import { describe, expect, it } from "vitest";
import { filterByAssignee } from "./lane-model";

type Card = { id: string; assigneeId: string | null };

describe("filterByAssignee", () => {
  it("keeps only cards assigned to the given person", () => {
    const cards: Card[] = [
      { id: "a", assigneeId: "person-1" },
      { id: "b", assigneeId: "person-2" },
      { id: "c", assigneeId: null },
    ];

    expect(filterByAssignee(cards, "person-1")).toEqual([{ id: "a", assigneeId: "person-1" }]);
  });

  it("returns every card unchanged when no assignee is given", () => {
    const cards: Card[] = [
      { id: "a", assigneeId: "person-1" },
      { id: "b", assigneeId: null },
    ];

    expect(filterByAssignee(cards, null)).toBe(cards);
  });
});