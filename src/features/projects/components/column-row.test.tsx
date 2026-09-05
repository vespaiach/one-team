import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DeleteColumnState, UpdateColumnState } from "../column-actions";
import type { ColumnDeleteRefusal } from "../server/column-delete-refusal";
import type { ProjectColumnRow } from "../server/queries";
import { ColumnRow } from "./column-row";

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

const todo: ProjectColumnRow = {
  id: "c2",
  name: "Todo",
  kind: "open",
  position: 1,
  issueCount: 7,
  deleteRefusal: null,
};

function renderRow(
  updateColumn?: (input: { columnId: string; name: string }) => Promise<UpdateColumnState>,
  column: ProjectColumnRow = todo,
  deleteColumn?: (input: { columnId: string }) => Promise<DeleteColumnState>,
) {
  return render(
    <ColumnRow
      column={column}
      updateColumn={updateColumn}
      deleteColumn={deleteColumn}
    />,
  );
}

describe("ColumnRow — what every role sees (FR-014, FR-015, FR-017)", () => {
  it("renders kind as text for an admin, never as a control", () => {
    renderRow(vi.fn());

    expect(screen.getByText("open")).not.toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryByRole("button", { name: /kind/i })).toBeNull();
  });

  it("renders the live issue count", () => {
    renderRow(vi.fn());

    expect(screen.getByText("7")).not.toBeNull();
  });

  it("offers no colour swatch — a column is told apart by name alone", () => {
    const { container } = renderRow(vi.fn());

    expect(container.querySelector("[data-column-colour]")).toBeNull();
    expect(screen.queryByRole("button", { name: /colour|color/i })).toBeNull();
  });

  it("renders name, kind and count as static text with no control at all for a non-admin", () => {
    renderRow(undefined);

    expect(screen.getByText("Todo")).not.toBeNull();
    expect(screen.getByText("open")).not.toBeNull();
    expect(screen.getByText("7")).not.toBeNull();
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.queryAllByRole("textbox")).toHaveLength(0);
  });
});

describe("ColumnRow — the rename gesture (FR-024, OT-UX-010)", () => {
  it("opens a field in place when the name is activated", async () => {
    renderRow(vi.fn());

    fireEvent.click(screen.getByRole("button", { name: "Column name" }));

    const input = await screen.findByRole("textbox", { name: "Column name" });
    expect((input as HTMLInputElement).value).toBe("Todo");
  });

  it("reverts unchanged on Escape and returns focus to the control", async () => {
    const updateColumn = vi.fn();
    renderRow(updateColumn);

    fireEvent.click(screen.getByRole("button", { name: "Column name" }));
    const input = await screen.findByRole("textbox", { name: "Column name" });
    fireEvent.change(input, { target: { value: "Up next" } });
    fireEvent.keyDown(input, { key: "Escape" });

    const button = await screen.findByRole("button", { name: "Column name" });
    expect(button.textContent).toBe("Todo");
    expect(document.activeElement).toBe(button);
    expect(updateColumn).not.toHaveBeenCalled();
  });

  it("saves on blur, exactly once per rename", async () => {
    const updateColumn = vi.fn().mockResolvedValue({ ok: true } satisfies UpdateColumnState);
    renderRow(updateColumn);

    fireEvent.click(screen.getByRole("button", { name: "Column name" }));
    const input = await screen.findByRole("textbox", { name: "Column name" });
    fireEvent.change(input, { target: { value: "Up next" } });
    fireEvent.blur(input);

    await waitFor(() => expect(updateColumn).toHaveBeenCalledTimes(1));
    expect(updateColumn).toHaveBeenCalledWith({ columnId: "c2", name: "Up next" });
  });

  it("saves on ⌘-enter and on Ctrl-enter", async () => {
    const updateColumn = vi.fn().mockResolvedValue({ ok: true } satisfies UpdateColumnState);
    renderRow(updateColumn);

    fireEvent.click(screen.getByRole("button", { name: "Column name" }));
    fireEvent.change(await screen.findByRole("textbox", { name: "Column name" }), {
      target: { value: "Up next" },
    });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Column name" }), {
      key: "Enter",
      metaKey: true,
    });
    await waitFor(() => expect(updateColumn).toHaveBeenCalledTimes(1));

    fireEvent.click(await screen.findByRole("button", { name: "Column name" }));
    fireEvent.change(await screen.findByRole("textbox", { name: "Column name" }), {
      target: { value: "Later" },
    });
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Column name" }), {
      key: "Enter",
      ctrlKey: true,
    });
    await waitFor(() => expect(updateColumn).toHaveBeenCalledTimes(2));
  });

  it("returns focus to the control after a save closes the field", async () => {
    const updateColumn = vi.fn().mockResolvedValue({ ok: true } satisfies UpdateColumnState);
    renderRow(updateColumn);

    fireEvent.click(screen.getByRole("button", { name: "Column name" }));
    const input = await screen.findByRole("textbox", { name: "Column name" });
    fireEvent.change(input, { target: { value: "Up next" } });
    fireEvent.blur(input);

    const button = await screen.findByRole("button", { name: "Column name" });
    await waitFor(() => expect(document.activeElement).toBe(button));
  });

  it("makes no call at all when a blur leaves the value unchanged", async () => {
    const updateColumn = vi.fn();
    renderRow(updateColumn);

    fireEvent.click(screen.getByRole("button", { name: "Column name" }));
    fireEvent.blur(await screen.findByRole("textbox", { name: "Column name" }));

    await screen.findByRole("button", { name: "Column name" });
    expect(updateColumn).not.toHaveBeenCalled();
  });
});

describe("ColumnRow — every refused rename renders inline (FR-025, FR-027, OT-UX-012)", () => {
  async function rename(
    updateColumn: (input: { columnId: string; name: string }) => Promise<UpdateColumnState>,
  ) {
    renderRow(updateColumn);
    fireEvent.click(screen.getByRole("button", { name: "Column name" }));
    const input = await screen.findByRole("textbox", { name: "Column name" });
    fireEvent.change(input, { target: { value: "Backlog" } });
    fireEvent.blur(input);
  }

  it("maps duplicate_name to the inline conflict variant, naming the holder", async () => {
    await rename(
      vi.fn().mockResolvedValue({
        ok: false,
        error: "duplicate_name",
        holder: { id: "c1", name: "Backlog" },
      } satisfies UpdateColumnState),
    );

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("That name is already taken by the column Backlog.");
    expect(showToastMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Something went wrong. Try again.")).toBeNull();
    await waitFor(() => expect(screen.getByRole("button", { name: "Column name" }).textContent).toBe("Todo"));
  });

  it("maps forbidden to the inline conflict variant too, never to the generic toast", async () => {
    await rename(vi.fn().mockResolvedValue({ ok: false, error: "forbidden" } satisfies UpdateColumnState));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      "That rename wasn't saved — only an admin can rename a project's columns.",
    );
    expect(showToastMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Something went wrong. Try again.")).toBeNull();
    await waitFor(() => expect(screen.getByRole("button", { name: "Column name" }).textContent).toBe("Todo"));
  });

  it("leaves invalid_name to EditableField's own invalid wording", async () => {
    await rename(
      vi.fn().mockResolvedValue({
        ok: false,
        error: "invalid_name",
        reason: "too_long",
      } satisfies UpdateColumnState),
    );

    await waitFor(() => expect(showToastMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

const REFUSAL_MESSAGES: [ColumnDeleteRefusal, string][] = [
  ["holds_issues", "This column still holds issues. Move them to another column before deleting it."],
  ["last_column", "This is the project's last column, and a project always has at least one."],
  [
    "last_canceled_kind",
    "This is the project's last canceled column, and it's a member's only way to remove an issue.",
  ],
  [
    "last_done_kind",
    "This is the project's last done column, so no work could be counted as done — and a column's kind can't be changed afterwards.",
  ],
];

describe("ColumnRow — the Delete control and its four refusals (FR-016, FR-039, SC-004, SC-010)", () => {
  it("gives a non-admin no Delete control at all", () => {
    renderRow(undefined, todo, undefined);

    expect(screen.queryByRole("button", { name: "Delete" })).toBeNull();
  });

  it("always renders an admin's Delete control, enabled when no refusal holds", () => {
    renderRow(vi.fn(), { ...todo, issueCount: 0 }, vi.fn());

    const control = screen.getByRole("button", { name: "Delete" });
    expect(control.hasAttribute("disabled")).toBe(false);
    expect(control.getAttribute("aria-describedby")).toBeNull();
  });

  it("opens the confirmation naming the column when no refusal holds", async () => {
    renderRow(vi.fn(), { ...todo, issueCount: 0 }, vi.fn());

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect((await screen.findByRole("dialog")).textContent).toContain("Todo");
  });

  it.each(
    REFUSAL_MESSAGES,
  )("renders the Delete control visible and disabled for %s, with that refusal's own wording inline", (refusal, message) => {
    renderRow(vi.fn(), { ...todo, deleteRefusal: refusal }, vi.fn());

    const control = screen.getByRole("button", { name: "Delete" });
    expect(control.hasAttribute("disabled")).toBe(true);
    const describedBy = control.getAttribute("aria-describedby");
    expect(describedBy).not.toBeNull();
    const reason = document.getElementById(describedBy ?? "");
    expect(reason?.tagName).toBe("P");
    expect(reason?.textContent).toBe(message);
  });

  it("agrees with the count rendered beside it — a column holding issues cannot be deleted", () => {
    const { unmount } = renderRow(
      vi.fn(),
      { ...todo, issueCount: 7, deleteRefusal: "holds_issues" },
      vi.fn(),
    );

    expect(screen.getByText("7")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Delete" }).hasAttribute("disabled")).toBe(true);
    unmount();

    renderRow(vi.fn(), { ...todo, issueCount: 0, deleteRefusal: null }, vi.fn());

    expect(screen.getByText("0")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Delete" }).hasAttribute("disabled")).toBe(false);
  });

  it("describes the last render and never promises the server will agree — a refused confirm leaves the control as rendered", async () => {
    const deleteColumn = vi.fn().mockResolvedValue({
      ok: false,
      error: "refused",
      refusal: "holds_issues",
    } satisfies DeleteColumnState);
    renderRow(vi.fn(), { ...todo, issueCount: 0, deleteRefusal: null }, deleteColumn);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => expect(deleteColumn).toHaveBeenCalledWith({ columnId: "c2" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: "Delete" }).hasAttribute("disabled")).toBe(false);
  });
});
describe("ColumnRow — a confirmed delete the server refuses (FR-010, FR-052, SC-004)", () => {
  async function confirmDelete(deleteColumn: (input: { columnId: string }) => Promise<DeleteColumnState>) {
    renderRow(vi.fn(), { ...todo, issueCount: 0, deleteRefusal: null }, deleteColumn);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Confirm delete" }));
  }

  it("reports a not_found column as already gone and refreshes the section", async () => {
    await confirmDelete(
      vi.fn().mockResolvedValue({ ok: false, error: "not_found" } satisfies DeleteColumnState),
    );

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      "That column wasn't deleted — it has already been deleted. The list has been refreshed.",
    );
    await waitFor(() => expect(refreshMock).toHaveBeenCalledTimes(1));
    expect(showToastMock).not.toHaveBeenCalled();
  });

  it.each(
    REFUSAL_MESSAGES,
  )("states %s in its own words inline on the Delete control, never a generic failure", async (refusal, message) => {
    await confirmDelete(
      vi.fn().mockResolvedValue({ ok: false, error: "refused", refusal } satisfies DeleteColumnState),
    );

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(message);
    expect(screen.getByRole("button", { name: "Delete" }).getAttribute("aria-describedby")).toBe(alert.id);
    expect(showToastMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("states a forbidden deletion from a stale-role page inline, naming what failed and why", async () => {
    await confirmDelete(
      vi.fn().mockResolvedValue({ ok: false, error: "forbidden" } satisfies DeleteColumnState),
    );

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe(
      "That column wasn't deleted — only an admin can delete a project's columns.",
    );
    expect(screen.getByRole("button", { name: "Delete" }).getAttribute("aria-describedby")).toBe(alert.id);
    expect(showToastMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });
});

describe("ColumnRow — the accessibility and interaction sweep (FR-018, SC-013, OT-UX-018)", () => {
  it("names the rename control and the Delete control an admin gets", () => {
    renderRow(vi.fn(), { ...todo, issueCount: 0 }, vi.fn());

    expect(screen.getByRole("button", { name: "Column name" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Delete" })).not.toBeNull();
  });

  it("keeps an enabled Delete control keyboard-focusable, and gives a disabled one its reason as text", () => {
    const { unmount } = renderRow(vi.fn(), { ...todo, issueCount: 0 }, vi.fn());

    const enabled = screen.getByRole("button", { name: "Delete" });
    enabled.focus();
    expect(document.activeElement).toBe(enabled);
    unmount();

    renderRow(vi.fn(), { ...todo, deleteRefusal: "last_column" }, vi.fn());

    const refused = screen.getByRole("button", { name: "Delete" });
    const reason = document.getElementById(refused.getAttribute("aria-describedby") ?? "");
    expect(reason?.textContent).toBe(
      "This is the project's last column, and a project always has at least one.",
    );
  });
});

describe("ColumnRow — two rows refused at once keep their own message (FR-018, FR-027)", () => {
  const doing: ProjectColumnRow = {
    id: "c3",
    name: "Doing",
    kind: "open",
    position: 2,
    issueCount: 3,
    deleteRefusal: null,
  };

  async function refuseRenameOnBothRows() {
    const updateColumn = vi.fn(
      async ({ columnId }: { columnId: string; name: string }): Promise<UpdateColumnState> => ({
        ok: false,
        error: "duplicate_name",
        holder: { id: "c1", name: columnId === "c2" ? "Backlog" : "Shipped" },
      }),
    );
    render(
      <>
        <ColumnRow
          column={todo}
          updateColumn={updateColumn}
        />
        <ColumnRow
          column={doing}
          updateColumn={updateColumn}
        />
      </>,
    );

    for (const rowIndex of [0, 1]) {
      fireEvent.click(screen.getAllByRole("button", { name: "Column name" })[rowIndex]);
      const input = await screen.findByRole("textbox", { name: "Column name" });
      fireEvent.change(input, { target: { value: "Taken" } });
      fireEvent.blur(input);
      await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(rowIndex + 1));
    }
  }

  it("gives each row's conflict alert an id of its own", async () => {
    await refuseRenameOnBothRows();

    const [first, second] = screen.getAllByRole("alert");
    expect(first.id).not.toBe("");
    expect(second.id).not.toBe(first.id);
  });

  it("describes each name control by that row's own alert, not the row above it", async () => {
    await refuseRenameOnBothRows();

    const alerts = screen.getAllByRole("alert");
    const buttons = screen.getAllByRole("button", { name: "Column name" });
    const messages = [
      "That name is already taken by the column Backlog.",
      "That name is already taken by the column Shipped.",
    ];

    for (const rowIndex of [0, 1]) {
      const described = document.getElementById(buttons[rowIndex].getAttribute("aria-describedby") ?? "");
      expect(described).toBe(alerts[rowIndex]);
      expect(described?.textContent).toBe(messages[rowIndex]);
    }
  });
});