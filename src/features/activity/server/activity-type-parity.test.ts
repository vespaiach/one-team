import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const EXPECTED_VALUES = [
  "created",
  "field_changed",
  "member_added",
  "member_removed",
  "archived",
  "reopened",
  "comment",
  "column_added",
  "column_renamed",
  "column_reordered",
  "column_deleted",
];

function declaredActivityTypeValues(fileName: string): string[] {
  const source = readFileSync(join(__dirname, fileName), "utf8");
  const declaration = source.match(/export type ActivityType =([\s\S]*?);/);
  if (!declaration?.[1]) {
    throw new Error(`${fileName} declares no ActivityType`);
  }
  return Array.from(declaration[1].matchAll(/"([a-z_]+)"/g), (match) => match[1] ?? "");
}

describe("the two ActivityType declarations stay in step (FR-042, data-model §4)", () => {
  it.each(["write-activity.ts", "feed-queries.ts"])("%s declares the eleven admitted values", (fileName) => {
    expect(declaredActivityTypeValues(fileName)).toEqual(EXPECTED_VALUES);
  });

  it("declares the same values in both modules", () => {
    expect(declaredActivityTypeValues("feed-queries.ts")).toEqual(
      declaredActivityTypeValues("write-activity.ts"),
    );
  });
});