import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CreateColumnState } from "../column-actions";
import { AddColumnForm } from "./add-column-form";

function renderForm(
  createColumn: (input: { projectKey: string; name: string }) => Promise<CreateColumnState>,
) {
  return render(
    <AddColumnForm
      projectKey="WR"
      createColumn={createColumn}
    />,
  );
}

const saved: CreateColumnState = {
  ok: true,
  column: { id: "c1", name: "Review", kind: "open", position: 5, issueCount: 0, deleteRefusal: null },
};

describe("AddColumnForm — a name field and nothing else (FR-019, FR-020)", () => {
  it("offers one text field and no kind or position control", () => {
    renderForm(vi.fn().mockResolvedValue(saved));

    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.getByRole("textbox", { name: "Column name" })).not.toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("radiogroup")).toBeNull();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("submits the trimmed name for the project it was given", async () => {
    const createColumn = vi.fn().mockResolvedValue(saved);
    renderForm(createColumn);

    fireEvent.change(screen.getByRole("textbox", { name: "Column name" }), {
      target: { value: "  Review  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add column" }));

    await waitFor(() => expect(createColumn).toHaveBeenCalledWith({ projectKey: "WR", name: "Review" }));
  });

  it("clears the field after a successful add", async () => {
    renderForm(vi.fn().mockResolvedValue(saved));

    const field = screen.getByRole("textbox", { name: "Column name" });
    fireEvent.change(field, { target: { value: "Review" } });
    fireEvent.click(screen.getByRole("button", { name: "Add column" }));

    await waitFor(() => expect((field as HTMLInputElement).value).toBe(""));
  });
});

describe("AddColumnForm — validation stays inline and the control stays enabled (OT-UX-011)", () => {
  it("reports a missing name on blur without disabling the submit control", async () => {
    const createColumn = vi.fn();
    renderForm(createColumn);

    const field = screen.getByRole("textbox", { name: "Column name" });
    fireEvent.blur(field);

    expect(await screen.findByText("Column name is required.")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Add column" }).hasAttribute("disabled")).toBe(false);
    expect(createColumn).not.toHaveBeenCalled();
  });

  it("reports a whitespace-only name inline and calls the server for nothing", async () => {
    const createColumn = vi.fn();
    renderForm(createColumn);

    fireEvent.change(screen.getByRole("textbox", { name: "Column name" }), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Add column" }));

    expect(await screen.findByText("Column name is required.")).not.toBeNull();
    expect(createColumn).not.toHaveBeenCalled();
  });

  it("reports a 201-character name inline and never truncates it", async () => {
    const createColumn = vi.fn();
    renderForm(createColumn);

    const field = screen.getByRole("textbox", { name: "Column name" });
    fireEvent.change(field, { target: { value: "x".repeat(201) } });
    fireEvent.blur(field);

    expect(await screen.findByText("Column name is too long.")).not.toBeNull();
    expect((field as HTMLInputElement).value).toHaveLength(201);
    expect(createColumn).not.toHaveBeenCalled();
  });

  it("associates the error with the field and never signals it by colour alone", async () => {
    renderForm(vi.fn());

    const field = screen.getByRole("textbox", { name: "Column name" });
    fireEvent.blur(field);

    const message = await screen.findByText("Column name is required.");
    expect(field.getAttribute("aria-describedby")?.split(" ")).toContain(message.getAttribute("id"));
    expect(field.getAttribute("aria-invalid")).toBe("true");
  });
});

describe("AddColumnForm — the collision (FR-021, OT-UX-012)", () => {
  it("renders the refusal inline naming the existing column, applying no suffix and retrying nothing", async () => {
    const createColumn = vi.fn().mockResolvedValue({
      ok: false,
      error: "duplicate_name",
      holder: { id: "c0", name: "Backlog" },
    } satisfies CreateColumnState);
    renderForm(createColumn);

    const field = screen.getByRole("textbox", { name: "Column name" });
    fireEvent.change(field, { target: { value: "backlog" } });
    fireEvent.click(screen.getByRole("button", { name: "Add column" }));

    expect(await screen.findByText("That name is already taken by the column Backlog.")).not.toBeNull();
    expect(createColumn).toHaveBeenCalledTimes(1);
    expect((field as HTMLInputElement).value).toBe("backlog");
  });

  it("renders a forbidden refusal inline, in the wording the refused rename uses", async () => {
    const createColumn = vi.fn().mockResolvedValue({
      ok: false,
      error: "forbidden",
    } satisfies CreateColumnState);
    renderForm(createColumn);

    fireEvent.change(screen.getByRole("textbox", { name: "Column name" }), { target: { value: "Review" } });
    fireEvent.click(screen.getByRole("button", { name: "Add column" }));

    expect(
      await screen.findByText("That column wasn't added — only an admin can add a project's columns."),
    ).not.toBeNull();
  });

  it("renders a server-side invalid_name refusal inline", async () => {
    const createColumn = vi.fn().mockResolvedValue({
      ok: false,
      error: "invalid_name",
      reason: "too_long",
    } satisfies CreateColumnState);
    renderForm(createColumn);

    fireEvent.change(screen.getByRole("textbox", { name: "Column name" }), { target: { value: "Review" } });
    fireEvent.click(screen.getByRole("button", { name: "Add column" }));

    expect(await screen.findByText("Column name is too long.")).not.toBeNull();
  });
});

describe("AddColumnForm — waiting for the server (OT-UX-008)", () => {
  it("shows in-flight state while the call is outstanding", async () => {
    let settle: (value: CreateColumnState) => void = () => {};
    const createColumn = vi.fn().mockReturnValue(
      new Promise<CreateColumnState>((resolve) => {
        settle = resolve;
      }),
    );
    renderForm(createColumn);

    fireEvent.change(screen.getByRole("textbox", { name: "Column name" }), { target: { value: "Review" } });
    fireEvent.click(screen.getByRole("button", { name: "Add column" }));

    expect(await screen.findByRole("button", { name: "Adding…" })).not.toBeNull();

    settle(saved);
    await waitFor(() => expect(screen.getByRole("button", { name: "Add column" })).not.toBeNull());
  });
});
describe("AddColumnForm — the accessibility and interaction sweep (FR-018, SC-013, OT-UX-018)", () => {
  it("names both of the controls it adds", () => {
    renderForm(vi.fn());

    expect(screen.getByRole("textbox", { name: "Column name" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Add column" })).not.toBeNull();
  });

  it("ties a server refusal to the field itself, as text and never as colour", async () => {
    const createColumn = vi.fn().mockResolvedValue({
      ok: false,
      error: "duplicate_name",
      holder: { id: "c0", name: "Backlog" },
    } satisfies CreateColumnState);
    renderForm(createColumn);

    const field = screen.getByRole("textbox", { name: "Column name" });
    fireEvent.change(field, { target: { value: "backlog" } });
    fireEvent.click(screen.getByRole("button", { name: "Add column" }));

    const message = await screen.findByText("That name is already taken by the column Backlog.");
    expect(field.getAttribute("aria-describedby")?.split(" ")).toContain(message.getAttribute("id"));
    expect(field.getAttribute("aria-invalid")).toBe("true");
  });
});