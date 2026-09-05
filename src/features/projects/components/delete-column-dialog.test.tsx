import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DeleteColumnDialog } from "./delete-column-dialog";

function openDialog() {
  const trigger = screen.getByRole("button", { name: "Delete" });
  trigger.focus();
  fireEvent.click(trigger);
  return trigger;
}

describe("DeleteColumnDialog (FR-039, SC-014)", () => {
  it("raises a confirmation naming the column, over the section", async () => {
    render(
      <DeleteColumnDialog
        columnName="Todo"
        onDelete={vi.fn()}
      />,
    );

    openDialog();

    const dialog = await screen.findByRole("dialog");
    expect(dialog.textContent).toContain("Todo");
  });

  it("calls onDelete exactly once on Confirm, and shows in-flight state while it waits", async () => {
    let settle = () => {};
    const onDelete = vi.fn().mockReturnValue(
      new Promise<void>((resolve) => {
        settle = resolve;
      }),
    );
    render(
      <DeleteColumnDialog
        columnName="Todo"
        onDelete={onDelete}
      />,
    );

    openDialog();
    await screen.findByRole("dialog");
    const confirm = screen.getByRole("button", { name: "Confirm delete" });
    fireEvent.click(confirm);

    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "Confirm delete" }).hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Confirm delete" }).textContent).toBe("Deleting…");

    settle();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it("writes nothing on Cancel, and returns focus to the Delete control", async () => {
    const onDelete = vi.fn();
    render(
      <DeleteColumnDialog
        columnName="Todo"
        onDelete={onDelete}
      />,
    );

    const trigger = openDialog();
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onDelete).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("writes nothing on Escape, and returns focus to the Delete control", async () => {
    const onDelete = vi.fn();
    render(
      <DeleteColumnDialog
        columnName="Todo"
        onDelete={onDelete}
      />,
    );

    const trigger = openDialog();
    const dialog = await screen.findByRole("dialog");
    fireEvent.keyDown(dialog, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onDelete).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("writes nothing when dismissed from outside the dialog", async () => {
    const onDelete = vi.fn();
    render(
      <DeleteColumnDialog
        columnName="Todo"
        onDelete={onDelete}
      />,
    );

    const trigger = openDialog();
    await screen.findByRole("dialog");
    const underlay = screen.getByRole("dialog").parentElement?.parentElement;
    if (!underlay) {
      throw new Error("the modal renders no underlay");
    }
    fireEvent.pointerDown(underlay);
    fireEvent.pointerUp(underlay);
    fireEvent.click(underlay);

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(onDelete).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});
describe("DeleteColumnDialog — the accessibility and interaction sweep (FR-018, SC-013, OT-UX-018)", () => {
  function pressEnter(element: HTMLElement) {
    fireEvent.keyDown(element, { key: "Enter" });
    fireEvent.keyUp(element, { key: "Enter" });
  }

  it("names the trigger and both dialog controls", async () => {
    render(
      <DeleteColumnDialog
        columnName="Todo"
        onDelete={vi.fn()}
      />,
    );

    openDialog();
    await screen.findByRole("dialog");

    expect(screen.getByRole("button", { name: "Cancel" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Confirm delete" })).not.toBeNull();
  });

  it("opens, confirms and returns focus with the keyboard alone", async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(
      <DeleteColumnDialog
        columnName="Todo"
        onDelete={onDelete}
      />,
    );

    const trigger = screen.getByRole("button", { name: "Delete" });
    trigger.focus();
    pressEnter(trigger);

    const dialog = await screen.findByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);

    pressEnter(screen.getByRole("button", { name: "Confirm delete" }));

    await waitFor(() => expect(onDelete).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });
});