export type ColumnMeta = {
  id: string;
  name: string;
  kind: "open" | "done" | "canceled";
  sortOrder: string;
};

type PriorityRank = "urgent" | "high" | "medium" | "low" | "none";

const PRIORITY_ORDER: Record<PriorityRank, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

export type ColumnGroup<T> = {
  name: string;
  items: T[];
};

export function groupByColumn<T extends { columnId: string; priority: PriorityRank }>(
  items: readonly T[],
  columns: readonly ColumnMeta[],
): ColumnGroup<T>[] {
  const openColumnById = new Map(
    columns.filter((column) => column.kind === "open").map((column) => [column.id, column]),
  );

  const itemsByName = new Map<string, T[]>();
  const earliestSortOrderByName = new Map<string, string>();
  for (const item of items) {
    const column = openColumnById.get(item.columnId);
    if (!column) {
      continue;
    }
    const existing = itemsByName.get(column.name);
    if (existing) {
      existing.push(item);
    } else {
      itemsByName.set(column.name, [item]);
    }
    const earliest = earliestSortOrderByName.get(column.name);
    if (earliest === undefined || column.sortOrder < earliest) {
      earliestSortOrderByName.set(column.name, column.sortOrder);
    }
  }

  return Array.from(itemsByName.entries())
    .sort(([nameA], [nameB]) => {
      const a = earliestSortOrderByName.get(nameA) as string;
      const b = earliestSortOrderByName.get(nameB) as string;
      return a < b ? -1 : a > b ? 1 : 0;
    })
    .map(([name, groupItems]) => ({
      name,
      items: [...groupItems].sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]),
    }));
}