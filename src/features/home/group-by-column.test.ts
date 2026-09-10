import { describe, expect, it } from "vitest";
import { type ColumnMeta, groupByColumn } from "./group-by-column";

const TODO: ColumnMeta = { id: "col-todo", name: "Todo", kind: "open", sortOrder: "a1" };
const IN_PROGRESS: ColumnMeta = { id: "col-progress", name: "In Progress", kind: "open", sortOrder: "a2" };
const DONE: ColumnMeta = { id: "col-done", name: "Done", kind: "done", sortOrder: "a3" };
const CANCELED: ColumnMeta = { id: "col-canceled", name: "Canceled", kind: "canceled", sortOrder: "a4" };
const OTHER_PROJECT_TODO: ColumnMeta = { id: "col-todo-2", name: "Todo", kind: "open", sortOrder: "b1" };

type Item = { id: string; columnId: string; priority: "urgent" | "high" | "medium" | "low" | "none" };

describe("groupByColumn", () => {
  it("groups items under their column name, ordered by the earliest matching column's sortOrder", () => {
    const items: Item[] = [
      { id: "1", columnId: IN_PROGRESS.id, priority: "none" },
      { id: "2", columnId: TODO.id, priority: "none" },
    ];

    const groups = groupByColumn(items, [IN_PROGRESS, TODO]);

    expect(groups.map((group) => group.name)).toEqual(["Todo", "In Progress"]);
    expect(groups[0]?.items.map((item) => item.id)).toEqual(["2"]);
    expect(groups[1]?.items.map((item) => item.id)).toEqual(["1"]);
  });

  it("merges same-named columns from different projects into a single group", () => {
    const items: Item[] = [
      { id: "1", columnId: TODO.id, priority: "none" },
      { id: "2", columnId: OTHER_PROJECT_TODO.id, priority: "none" },
    ];

    const groups = groupByColumn(items, [TODO, OTHER_PROJECT_TODO]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.name).toBe("Todo");
    expect(groups[0]?.items.map((item) => item.id).sort()).toEqual(["1", "2"]);
  });

  it("sorts items within a group by priority, descending", () => {
    const items: Item[] = [
      { id: "low", columnId: TODO.id, priority: "low" },
      { id: "urgent", columnId: TODO.id, priority: "urgent" },
      { id: "none", columnId: TODO.id, priority: "none" },
      { id: "high", columnId: TODO.id, priority: "high" },
      { id: "medium", columnId: TODO.id, priority: "medium" },
    ];

    const groups = groupByColumn(items, [TODO]);

    expect(groups[0]?.items.map((item) => item.id)).toEqual(["urgent", "high", "medium", "low", "none"]);
  });

  it("excludes items sitting in a done or canceled column", () => {
    const items: Item[] = [
      { id: "kept", columnId: TODO.id, priority: "none" },
      { id: "done", columnId: DONE.id, priority: "urgent" },
      { id: "canceled", columnId: CANCELED.id, priority: "urgent" },
    ];

    const groups = groupByColumn(items, [TODO, DONE, CANCELED]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.items.map((item) => item.id)).toEqual(["kept"]);
  });

  it("omits columns with no items", () => {
    const items: Item[] = [{ id: "1", columnId: TODO.id, priority: "none" }];

    const groups = groupByColumn(items, [TODO, IN_PROGRESS]);

    expect(groups.map((group) => group.name)).toEqual(["Todo"]);
  });
});