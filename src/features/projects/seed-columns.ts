export type SeedColumn = {
  name: string;
  kind: "open" | "done" | "canceled";
  sortOrder: string;
};

export const SEED_COLUMNS: SeedColumn[] = [
  { name: "Backlog", kind: "open", sortOrder: "a0" },
  { name: "Todo", kind: "open", sortOrder: "a1" },
  { name: "In Progress", kind: "open", sortOrder: "a2" },
  { name: "Done", kind: "done", sortOrder: "a3" },
  { name: "Canceled", kind: "canceled", sortOrder: "a4" },
];