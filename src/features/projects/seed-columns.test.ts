import { describe, expect, it } from "vitest";
import { SEED_COLUMNS } from "./seed-columns";

describe("SEED_COLUMNS (FR-007)", () => {
  it("holds exactly five rows", () => {
    expect(SEED_COLUMNS).toHaveLength(5);
  });

  it("holds Backlog, Todo, In Progress, Done, Canceled in that order", () => {
    expect(SEED_COLUMNS.map((column) => column.name)).toEqual([
      "Backlog",
      "Todo",
      "In Progress",
      "Done",
      "Canceled",
    ]);
  });

  it("holds kinds open, open, open, done, canceled in that same order", () => {
    expect(SEED_COLUMNS.map((column) => column.kind)).toEqual(["open", "open", "open", "done", "canceled"]);
  });

  it('holds sort_order values that ascend under COLLATE "C" (byte order)', () => {
    const sortOrders = SEED_COLUMNS.map((column) => column.sortOrder);
    const sorted = [...sortOrders].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    expect(sortOrders).toEqual(sorted);
    expect(new Set(sortOrders).size).toBe(sortOrders.length);
  });
});