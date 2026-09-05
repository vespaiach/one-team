export type ColumnDeleteRefusal = "holds_issues" | "last_column" | "last_canceled_kind" | "last_done_kind";

export type ColumnDeleteFacts = {
  holdsIssues: boolean;
  isLastColumn: boolean;
  isLastCanceledKind: boolean;
  isLastDoneKind: boolean;
};

export function selectColumnDeleteRefusal(facts: ColumnDeleteFacts): ColumnDeleteRefusal | null {
  const byPrecedence: [ColumnDeleteRefusal, boolean][] = [
    ["holds_issues", facts.holdsIssues],
    ["last_column", facts.isLastColumn],
    ["last_canceled_kind", facts.isLastCanceledKind],
    ["last_done_kind", facts.isLastDoneKind],
  ];

  return byPrecedence.find(([, holds]) => holds)?.[0] ?? null;
}