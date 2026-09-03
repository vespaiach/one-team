import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ProjectColumnRow } from "../server/queries";
import { ColumnsSection } from "./columns-section";

const COLUMNS: ProjectColumnRow[] = [
  { id: "1", name: "Backlog", kind: "open", position: 0, issueCount: 0 },
  { id: "2", name: "Todo", kind: "open", position: 1, issueCount: 0 },
  { id: "3", name: "In Progress", kind: "open", position: 2, issueCount: 0 },
  { id: "4", name: "Done", kind: "done", position: 3, issueCount: 0 },
  { id: "5", name: "Canceled", kind: "canceled", position: 4, issueCount: 0 },
];

describe("ColumnsSection (FR-044)", () => {
  it("renders five rows in board order with name, kind and an issue count of 0", () => {
    render(<ColumnsSection columns={COLUMNS} />);

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(5);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Backlog") as string,
      expect.stringContaining("Todo") as string,
      expect.stringContaining("In Progress") as string,
      expect.stringContaining("Done") as string,
      expect.stringContaining("Canceled") as string,
    ]);
    for (const row of rows) {
      expect(row.textContent).toContain("0");
    }
  });

  it("offers no control that adds, renames, reorders or deletes", () => {
    render(<ColumnsSection columns={COLUMNS} />);

    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });
});