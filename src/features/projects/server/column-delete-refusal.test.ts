import { describe, expect, it } from "vitest";
import { type ColumnDeleteFacts, selectColumnDeleteRefusal } from "./column-delete-refusal";

const NONE: ColumnDeleteFacts = {
  holdsIssues: false,
  isLastColumn: false,
  isLastCanceledKind: false,
  isLastDoneKind: false,
};

function facts(overrides: Partial<ColumnDeleteFacts>): ColumnDeleteFacts {
  return { ...NONE, ...overrides };
}

describe("selectColumnDeleteRefusal (FR-038, SC-004)", () => {
  it("returns null when none of the four holds", () => {
    expect(selectColumnDeleteRefusal(NONE)).toBeNull();
  });

  it("returns each refusal on its own", () => {
    expect(selectColumnDeleteRefusal(facts({ holdsIssues: true }))).toBe("holds_issues");
    expect(selectColumnDeleteRefusal(facts({ isLastColumn: true }))).toBe("last_column");
    expect(selectColumnDeleteRefusal(facts({ isLastCanceledKind: true }))).toBe("last_canceled_kind");
    expect(selectColumnDeleteRefusal(facts({ isLastDoneKind: true }))).toBe("last_done_kind");
  });

  it("puts holds_issues ahead of every other refusal, so a non-empty last column still reports holds_issues", () => {
    expect(
      selectColumnDeleteRefusal(
        facts({ holdsIssues: true, isLastColumn: true, isLastCanceledKind: true, isLastDoneKind: true }),
      ),
    ).toBe("holds_issues");
    expect(selectColumnDeleteRefusal(facts({ holdsIssues: true, isLastColumn: true }))).toBe("holds_issues");
  });

  it("puts last_column ahead of the two kind refusals, so the project's only column reports last_column", () => {
    expect(
      selectColumnDeleteRefusal(
        facts({ isLastColumn: true, isLastCanceledKind: true, isLastDoneKind: true }),
      ),
    ).toBe("last_column");
    expect(selectColumnDeleteRefusal(facts({ isLastColumn: true, isLastDoneKind: true }))).toBe(
      "last_column",
    );
  });

  it("puts last_canceled_kind ahead of last_done_kind", () => {
    expect(selectColumnDeleteRefusal(facts({ isLastCanceledKind: true, isLastDoneKind: true }))).toBe(
      "last_canceled_kind",
    );
  });

  it("gives one column one answer whatever order the facts are supplied in", () => {
    const holding: ColumnDeleteFacts = {
      holdsIssues: true,
      isLastColumn: true,
      isLastCanceledKind: false,
      isLastDoneKind: true,
    };
    const reordered: ColumnDeleteFacts = {
      isLastDoneKind: true,
      isLastCanceledKind: false,
      isLastColumn: true,
      holdsIssues: true,
    };
    expect(selectColumnDeleteRefusal(holding)).toBe(selectColumnDeleteRefusal(reordered));
    expect(selectColumnDeleteRefusal(reordered)).toBe("holds_issues");
  });
});