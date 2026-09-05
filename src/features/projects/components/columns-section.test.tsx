import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CreateColumnState,
  DeleteColumnState,
  MoveColumnState,
  UpdateColumnState,
} from "../column-actions";
import type { ProjectColumnRow } from "../server/queries";
import { ColumnsSection } from "./columns-section";

const showToastMock = vi.fn();
vi.mock("@/features/shell/components/toast-region", () => ({
  showToast: (...args: unknown[]) => showToastMock(...args),
}));

const refreshMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}));

beforeEach(() => {
  showToastMock.mockClear();
  refreshMock.mockClear();
});

const COLUMNS: ProjectColumnRow[] = [
  { id: "1", name: "Backlog", kind: "open", position: 0, issueCount: 0, deleteRefusal: null },
  { id: "2", name: "Todo", kind: "open", position: 1, issueCount: 0, deleteRefusal: null },
  { id: "3", name: "In Progress", kind: "open", position: 2, issueCount: 0, deleteRefusal: null },
  { id: "4", name: "Done", kind: "done", position: 3, issueCount: 0, deleteRefusal: null },
  { id: "5", name: "Canceled", kind: "canceled", position: 4, issueCount: 0, deleteRefusal: null },
];

function adminProps() {
  return {
    projectKey: "WR",
    createColumn: vi.fn<(input: { projectKey: string; name: string }) => Promise<CreateColumnState>>(),
    updateColumn: vi.fn<(input: { columnId: string; name: string }) => Promise<UpdateColumnState>>(),
    moveColumn:
      vi.fn<
        (input: {
          columnId: string;
          targetColumnId: string;
          placement: "before" | "after";
        }) => Promise<MoveColumnState>
      >(),
    deleteColumn: vi.fn<(input: { columnId: string }) => Promise<DeleteColumnState>>(),
  };
}

describe("ColumnsSection — one markup for every role (FR-013, FR-014, research E-1)", () => {
  it("renders a grid with five rows in board order and no header row", () => {
    render(<ColumnsSection columns={COLUMNS} />);

    expect(screen.getByRole("grid")).not.toBeNull();
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(5);
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringContaining("Backlog") as string,
      expect.stringContaining("Todo") as string,
      expect.stringContaining("In Progress") as string,
      expect.stringContaining("Done") as string,
      expect.stringContaining("Canceled") as string,
    ]);
    expect(screen.queryAllByRole("columnheader")).toHaveLength(0);
  });

  it("carries name, kind and issue count on every row, for an admin as for anyone else", () => {
    render(
      <ColumnsSection
        columns={COLUMNS}
        admin={adminProps()}
      />,
    );

    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(5);
    expect(rows[3]?.textContent).toContain("Done");
    expect(rows[3]?.textContent).toContain("done");
    expect(rows[3]?.textContent).toContain("0");
  });

  it("offers no control that adds, renames, reorders or deletes", () => {
    render(<ColumnsSection columns={COLUMNS} />);

    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });

  it("offers an admin the add form and an editable name on every row", () => {
    render(
      <ColumnsSection
        columns={COLUMNS}
        admin={adminProps()}
      />,
    );

    expect(screen.getByRole("textbox", { name: "Column name" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Add column" })).not.toBeNull();
    expect(screen.getAllByRole("button", { name: "Column name" })).toHaveLength(5);
  });

  it("renders nothing but the grid when a project has no columns", () => {
    render(<ColumnsSection columns={[]} />);

    expect(screen.queryAllByRole("row")).toHaveLength(0);
    expect(screen.getByRole("grid")).not.toBeNull();
  });
});
describe("ColumnsSection — the reorder (FR-029, FR-031, FR-032, FR-053, SC-013)", () => {
  const ROLLBACK_MESSAGES: [MoveColumnState, string][] = [
    [
      { ok: false, error: "forbidden" },
      "That column wasn't moved — only an admin can reorder a project's columns.",
    ],
    [
      { ok: false, error: "not_found" },
      "That column wasn't moved — it has already been deleted. The list has been refreshed.",
    ],
    [
      { ok: false, error: "invalid_target" },
      "That column wasn't moved — a column can only be reordered among its own project's columns.",
    ],
    [
      { ok: false, error: "invalid_input" },
      "That column wasn't moved — that drop wasn't understood. Try the drag again.",
    ],
  ];

  function pressEnter(element: HTMLElement) {
    fireEvent.keyDown(element, { key: "Enter" });
    fireEvent.keyUp(element, { key: "Enter" });
  }

  function activeElement() {
    return document.activeElement as HTMLElement;
  }

  async function focusedDropIndicator() {
    await waitFor(() => expect(activeElement().getAttribute("aria-label")).toMatch(/^Insert/));
    return activeElement().getAttribute("aria-label");
  }

  async function liftWithKeyboard(columnName: string) {
    const handle = screen.getByRole("button", { name: `Drag ${columnName}` });
    handle.focus();
    expect(document.activeElement).toBe(handle);
    pressEnter(handle);
    await focusedDropIndicator();
  }

  async function pressArrowDown() {
    fireEvent.keyDown(activeElement(), { key: "ArrowDown" });
    fireEvent.keyUp(activeElement(), { key: "ArrowDown" });
    return focusedDropIndicator();
  }

  async function dragWithKeyboard(columnName: string, indicatorLabel: string) {
    await liftWithKeyboard(columnName);
    for (
      let step = 0;
      step < 12 && activeElement().getAttribute("aria-label") !== indicatorLabel;
      step += 1
    ) {
      await pressArrowDown();
    }
    expect(activeElement().getAttribute("aria-label")).toBe(indicatorLabel);
    pressEnter(activeElement());
  }

  function abandonDrag() {
    fireEvent.keyDown(activeElement(), { key: "Escape" });
    fireEvent.keyUp(activeElement(), { key: "Escape" });
  }

  function rowNames() {
    return screen.getAllByRole("row").map((row) => row.getAttribute("aria-label"));
  }

  it("gives an admin a drag affordance on every row and a non-admin none", () => {
    const forAdmin = render(
      <ColumnsSection
        columns={COLUMNS}
        admin={adminProps()}
      />,
    );

    expect(forAdmin.container.querySelectorAll("[data-allows-dragging]")).toHaveLength(5);
    expect(screen.getByRole("button", { name: "Drag Backlog" })).not.toBeNull();
    forAdmin.unmount();

    const forEveryoneElse = render(<ColumnsSection columns={COLUMNS} />);

    expect(forEveryoneElse.container.querySelectorAll("[data-allows-dragging]")).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Drag Backlog" })).toBeNull();
  });

  it("fires exactly one moveColumn call per drop, with a neighbour id and never an index or a sort order", async () => {
    const admin = adminProps();
    admin.moveColumn.mockResolvedValue({ ok: true });
    render(
      <ColumnsSection
        columns={COLUMNS}
        admin={admin}
      />,
    );

    await dragWithKeyboard("Backlog", "Insert between Done and Canceled");

    await waitFor(() => expect(admin.moveColumn).toHaveBeenCalledTimes(1));
    expect(admin.moveColumn).toHaveBeenCalledWith({
      columnId: "1",
      targetColumnId: "5",
      placement: "before",
    });
    const payload = admin.moveColumn.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(Object.keys(payload).sort()).toEqual(["columnId", "placement", "targetColumnId"]);
    expect(Object.values(payload).some((value) => typeof value === "number")).toBe(false);
  });

  it("names every step of the keyboard path and applies the reorder optimistically", async () => {
    const admin = adminProps();
    admin.moveColumn.mockReturnValue(new Promise(() => {}));
    render(
      <ColumnsSection
        columns={COLUMNS}
        admin={admin}
      />,
    );

    await liftWithKeyboard("Backlog");
    expect(await focusedDropIndicator()).toBe("Insert between Backlog and Todo");
    expect(await pressArrowDown()).toBe("Insert between Todo and In Progress");
    pressEnter(activeElement());

    await waitFor(() => expect(rowNames()).toEqual(["Todo", "Backlog", "In Progress", "Done", "Canceled"]));
  });

  it("writes nothing when a drag is abandoned with Escape or dropped outside the list", async () => {
    const admin = adminProps();
    render(
      <ColumnsSection
        columns={COLUMNS}
        admin={admin}
      />,
    );

    await liftWithKeyboard("Backlog");
    abandonDrag();

    expect(admin.moveColumn).not.toHaveBeenCalled();
    expect(rowNames()).toEqual(["Backlog", "Todo", "In Progress", "Done", "Canceled"]);

    await liftWithKeyboard("Backlog");
    fireEvent.drop(document.body);
    abandonDrag();

    expect(admin.moveColumn).not.toHaveBeenCalled();
    expect(rowNames()).toEqual(["Backlog", "Todo", "In Progress", "Done", "Canceled"]);
  });

  it.each(
    ROLLBACK_MESSAGES,
  )("rolls the order back and names %o inline beneath the list, never as a toast", async (state, message) => {
    const admin = adminProps();
    admin.moveColumn.mockResolvedValue(state);
    render(
      <ColumnsSection
        columns={COLUMNS}
        admin={admin}
      />,
    );

    await dragWithKeyboard("Backlog", "Insert between Done and Canceled");

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(message);
    expect(alert.tagName).toBe("P");
    expect(screen.getByRole("grid").getAttribute("aria-describedby")).toContain(alert.id);
    expect(showToastMock).not.toHaveBeenCalled();
    expect(rowNames()).toEqual(["Backlog", "Todo", "In Progress", "Done", "Canceled"]);
  });

  it("names a call that fails with no reason code, and refreshes the section only for not_found", async () => {
    const admin = adminProps();
    admin.moveColumn.mockRejectedValue(new Error("network"));
    const { unmount } = render(
      <ColumnsSection
        columns={COLUMNS}
        admin={admin}
      />,
    );

    await dragWithKeyboard("Backlog", "Insert between Done and Canceled");

    expect((await screen.findByRole("alert")).textContent).toBe("That column wasn't moved. Try again.");
    expect(refreshMock).not.toHaveBeenCalled();
    unmount();

    const refused = adminProps();
    refused.moveColumn.mockResolvedValue({ ok: false, error: "not_found" });
    render(
      <ColumnsSection
        columns={COLUMNS}
        admin={refused}
      />,
    );

    await dragWithKeyboard("Backlog", "Insert between Done and Canceled");

    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
  });

  it("clears the message on the next successful drop", async () => {
    const admin = adminProps();
    admin.moveColumn.mockResolvedValueOnce({ ok: false, error: "forbidden" });
    render(
      <ColumnsSection
        columns={COLUMNS}
        admin={admin}
      />,
    );

    await dragWithKeyboard("Backlog", "Insert between Done and Canceled");
    await screen.findByRole("alert");

    admin.moveColumn.mockResolvedValue({ ok: true });
    await dragWithKeyboard("Backlog", "Insert between Done and Canceled");

    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(screen.getByRole("grid").getAttribute("aria-describedby")).toBeNull();
  });
});
describe("ColumnsSection — the read-only list every non-admin gets (FR-012, FR-016, US4-1, US4-2, US4-4, US4-6)", () => {
  const READ_ONLY_COLUMNS: ProjectColumnRow[] = [
    { id: "1", name: "Backlog", kind: "open", position: 0, issueCount: 4, deleteRefusal: null },
    { id: "2", name: "Todo", kind: "open", position: 1, issueCount: 0, deleteRefusal: null },
    { id: "3", name: "In Progress", kind: "open", position: 2, issueCount: 2, deleteRefusal: null },
    { id: "4", name: "Done", kind: "done", position: 3, issueCount: 7, deleteRefusal: null },
    { id: "5", name: "Canceled", kind: "canceled", position: 4, issueCount: 1, deleteRefusal: null },
  ];

  function expectEveryRowWithKindAndCount() {
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(READ_ONLY_COLUMNS.length);
    rows.forEach((row, index) => {
      const column = READ_ONLY_COLUMNS[index];
      expect(row.getAttribute("aria-label")).toBe(column?.name);
      expect(within(row).getByText(String(column?.kind))).not.toBeNull();
      expect(within(row).getByText(String(column?.issueCount))).not.toBeNull();
    });
  }

  it.each([
    ["a project member"],
    ["a signed-in non-member"],
  ])("gives %s every row with its kind and its count — the section is handed no membership, only the columns", () => {
    render(<ColumnsSection columns={READ_ONLY_COLUMNS} />);

    expectEveryRowWithKindAndCount();
  });

  it("is a read-only list and not a disabled one — no add control, no editable name, no drag affordance, no delete control", () => {
    const { container } = render(<ColumnsSection columns={READ_ONLY_COLUMNS} />);

    expect(screen.queryAllByRole("button", { hidden: true })).toHaveLength(0);
    expect(screen.queryAllByRole("textbox", { hidden: true })).toHaveLength(0);
    expect(container.querySelectorAll("[data-allows-dragging]")).toHaveLength(0);
    expect(container.querySelectorAll("[disabled]")).toHaveLength(0);
    expect(container.querySelectorAll('[aria-disabled="true"]')).toHaveLength(0);
    expect(container.querySelectorAll("[data-disabled]")).toHaveLength(0);
  });

  it("drops the four controls on the next render when canAdminister goes false, removing no row and changing nothing else", () => {
    const { container, rerender } = render(
      <ColumnsSection
        columns={READ_ONLY_COLUMNS}
        admin={adminProps()}
      />,
    );

    expect(screen.getByRole("button", { name: "Add column" })).not.toBeNull();
    expect(screen.getAllByRole("button", { name: "Column name" })).toHaveLength(5);
    expect(screen.getAllByRole("button", { name: "Delete" })).toHaveLength(5);
    expect(container.querySelectorAll("[data-allows-dragging]")).toHaveLength(5);
    expectEveryRowWithKindAndCount();

    rerender(<ColumnsSection columns={READ_ONLY_COLUMNS} />);

    expect(screen.queryByRole("button", { name: "Add column" })).toBeNull();
    expect(screen.queryAllByRole("button", { name: "Column name" })).toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
    expect(container.querySelectorAll("[data-allows-dragging]")).toHaveLength(0);
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
    expectEveryRowWithKindAndCount();
  });
});
describe("ColumnsSection — the accessibility and interaction sweep (FR-018, SC-013, OT-UX-018)", () => {
  const COMPONENT_DIR = join(process.cwd(), "src", "features", "projects", "components");
  const SWEPT_COMPONENTS = [
    "add-column-form.tsx",
    "column-row.tsx",
    "delete-column-dialog.tsx",
    "columns-section.tsx",
  ];

  it("names the list and every row's drag affordance", () => {
    render(
      <ColumnsSection
        columns={COLUMNS}
        admin={adminProps()}
      />,
    );

    expect(screen.getByRole("grid", { name: "Columns" })).not.toBeNull();
    for (const column of COLUMNS) {
      expect(screen.getByRole("button", { name: `Drag ${column.name}` })).not.toBeNull();
    }
  });

  it.each(
    SWEPT_COMPONENTS,
  )("presses through React Aria in %s, with no hand-added role and no suppressed focus ring", (file) => {
    const source = readFileSync(join(COMPONENT_DIR, file), "utf8");

    expect(source).not.toMatch(/\bonClick\b/);
    expect(source).not.toMatch(/["\s](hover|focus|active):/);
    expect(source).not.toMatch(/\boutline-(none|0)\b/);
    expect(source).not.toMatch(/role="(button|checkbox|listbox|menu|menuitem|option|tab)"/);
  });

  it("styles focus-visible wherever it styles hover, press or selection", () => {
    for (const file of SWEPT_COMPONENTS) {
      const source = readFileSync(join(COMPONENT_DIR, file), "utf8");
      if (/data-\[(hovered|pressed|selected)\]/.test(source)) {
        expect(source).toMatch(/data-\[focus-visible\]/);
      }
    }
  });
});