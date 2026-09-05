import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EditableField } from "./editable-field";

const showToastMock = vi.fn();
vi.mock("@/features/shell/components/toast-region", () => ({
  showToast: (...args: unknown[]) => showToastMock(...args),
}));

beforeEach(() => {
  showToastMock.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("EditableField — the affordance and the gestures (FR-036, OT-UX-009)", () => {
  it("is a control with an accessible name that opens a focused field when pressed", async () => {
    const onSave = vi.fn();
    render(
      <EditableField
        label="Name"
        value="Website Redesign"
        onSave={onSave}
      />,
    );

    const button = screen.getByRole("button", { name: "Name" });
    fireEvent.click(button);

    const input = await screen.findByRole("textbox", { name: "Name" });
    expect((input as HTMLInputElement).value).toBe("Website Redesign");
    expect(document.activeElement).toBe(input);
  });

  it("opens by keyboard alone", async () => {
    const onSave = vi.fn();
    render(
      <EditableField
        label="Name"
        value="Website Redesign"
        onSave={onSave}
      />,
    );

    const button = screen.getByRole("button", { name: "Name" });
    button.focus();
    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.keyUp(button, { key: "Enter" });

    expect(await screen.findByRole("textbox", { name: "Name" })).not.toBeNull();
  });

  it("restores the previous value and writes nothing on Escape", async () => {
    const onSave = vi.fn();
    render(
      <EditableField
        label="Name"
        value="Website Redesign"
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    const input = await screen.findByRole("textbox", { name: "Name" });
    fireEvent.change(input, { target: { value: "Something Else" } });
    fireEvent.keyDown(input, { key: "Escape" });

    const button = await screen.findByRole("button", { name: "Name" });
    expect(button.textContent).toBe("Website Redesign");
    expect(onSave).not.toHaveBeenCalled();
  });

  it("returns focus to the control after Escape", async () => {
    const onSave = vi.fn();
    render(
      <EditableField
        label="Name"
        value="Website Redesign"
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    const input = await screen.findByRole("textbox", { name: "Name" });
    fireEvent.keyDown(input, { key: "Escape" });

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Name" })));
  });

  it("saves on blur, exactly once", async () => {
    const onSave = vi.fn().mockResolvedValue({ status: "saved" });
    render(
      <EditableField
        label="Name"
        value="Website Redesign"
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    const input = await screen.findByRole("textbox", { name: "Name" });
    fireEvent.change(input, { target: { value: "Renamed" } });
    fireEvent.blur(input);

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith("Renamed");
  });

  it("saves on Cmd+Enter without waiting for blur", async () => {
    const onSave = vi.fn().mockResolvedValue({ status: "saved" });
    render(
      <EditableField
        label="Name"
        value="Website Redesign"
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    const input = await screen.findByRole("textbox", { name: "Name" });
    fireEvent.change(input, { target: { value: "Renamed" } });
    fireEvent.keyDown(input, { key: "Enter", metaKey: true });

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith("Renamed");
  });

  it("saves on Ctrl+Enter for a platform with no Cmd key", async () => {
    const onSave = vi.fn().mockResolvedValue({ status: "saved" });
    render(
      <EditableField
        label="Name"
        value="Website Redesign"
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    const input = await screen.findByRole("textbox", { name: "Name" });
    fireEvent.change(input, { target: { value: "Renamed" } });
    fireEvent.keyDown(input, { key: "Enter", ctrlKey: true });

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith("Renamed");
  });

  it("makes no call on a blur whose value is unchanged", async () => {
    const onSave = vi.fn();
    render(
      <EditableField
        label="Name"
        value="Website Redesign"
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    const input = await screen.findByRole("textbox", { name: "Name" });
    fireEvent.blur(input);

    await screen.findByRole("button", { name: "Name" });
    expect(onSave).not.toHaveBeenCalled();
  });

  it("returns focus to the control after a save", async () => {
    const onSave = vi.fn().mockResolvedValue({ status: "saved" });
    render(
      <EditableField
        label="Name"
        value="Website Redesign"
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    const input = await screen.findByRole("textbox", { name: "Name" });
    fireEvent.change(input, { target: { value: "Renamed" } });
    fireEvent.blur(input);

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Name" })));
  });
});

describe("EditableField — at most one field open at a time (FR-036)", () => {
  it("closes the first field, saving it, when a second field is opened", async () => {
    const onSaveA = vi.fn().mockResolvedValue({ status: "saved" });
    const onSaveB = vi.fn().mockResolvedValue({ status: "saved" });
    render(
      <>
        <EditableField
          label="Name"
          value="Website Redesign"
          onSave={onSaveA}
        />
        <EditableField
          label="Description"
          value="A description"
          onSave={onSaveB}
        />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    const nameInput = await screen.findByRole("textbox", { name: "Name" });
    fireEvent.change(nameInput, { target: { value: "Renamed" } });

    fireEvent.blur(nameInput);
    fireEvent.click(screen.getByRole("button", { name: "Description" }));

    await waitFor(() => expect(onSaveA).toHaveBeenCalledWith("Renamed"));
    expect(await screen.findByRole("textbox", { name: "Description" })).not.toBeNull();
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
  });
});

describe("EditableField — optimistic save and rollback (FR-038)", () => {
  it("renders the new value immediately, before the server answers", async () => {
    let resolveSave: (value: { status: "saved" }) => void = () => undefined;
    const onSave = vi.fn(
      () =>
        new Promise<{ status: "saved" }>((resolve) => {
          resolveSave = resolve;
        }),
    );
    render(
      <EditableField
        label="Name"
        value="Website Redesign"
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    const input = await screen.findByRole("textbox", { name: "Name" });
    fireEvent.change(input, { target: { value: "Renamed" } });
    fireEvent.blur(input);

    const button = await screen.findByRole("button", { name: "Name" });
    expect(button.textContent).toBe("Renamed");

    resolveSave({ status: "saved" });
  });

  it("rolls back to the previous value and shows a message naming what failed, on refusal", async () => {
    const onSave = vi.fn().mockResolvedValue({ status: "invalid", reason: "too_long" });
    render(
      <EditableField
        label="Name"
        value="Website Redesign"
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    const input = await screen.findByRole("textbox", { name: "Name" });
    fireEvent.change(input, { target: { value: "Renamed" } });
    fireEvent.blur(input);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Name" }).textContent).toBe("Website Redesign"),
    );
    expect(showToastMock).toHaveBeenCalledWith({
      kind: "error",
      message: expect.stringContaining("Name") as string,
    });
  });
});

describe("EditableField — disabled with an inline reason (FR-021)", () => {
  it("renders disabled with the given reason and cannot be opened", () => {
    const onSave = vi.fn();
    render(
      <EditableField
        label="Name"
        value="Website Redesign"
        onSave={onSave}
        isDisabled
        disabledReason="You are not a member of this project."
      />,
    );

    const button = screen.getByRole("button", { name: "Name" });
    expect(button.hasAttribute("disabled")).toBe(true);
    expect(screen.getByText("You are not a member of this project.")).not.toBeNull();

    fireEvent.click(button);
    expect(screen.queryByRole("textbox", { name: "Name" })).toBeNull();
  });
});

describe("EditableField — empty values (FR-039)", () => {
  it("shows the placeholder as the button label when the value is empty", () => {
    const onSave = vi.fn();
    render(
      <EditableField
        label="Description"
        value={null}
        placeholder="Add a description"
        onSave={onSave}
      />,
    );

    expect(screen.getByRole("button", { name: "Description" }).textContent).toBe("Add a description");
  });
});
describe("EditableField — the conflict variant (FR-025, FR-027, OT-UX-012)", () => {
  it("renders the message inline as an alert, associated to the control, and raises no toast", async () => {
    const onSave = vi.fn().mockResolvedValue({
      status: "conflict",
      message: "That name is already taken by the column Backlog.",
    });
    render(
      <EditableField
        label="Name"
        value="Todo"
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    const input = await screen.findByRole("textbox", { name: "Name" });
    fireEvent.change(input, { target: { value: "Backlog" } });
    fireEvent.blur(input);

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("That name is already taken by the column Backlog.");
    const button = screen.getByRole("button", { name: "Name" });
    expect(button.getAttribute("aria-describedby")).toBe(alert.getAttribute("id"));
    expect(alert.getAttribute("id")).not.toBeNull();
    expect(showToastMock).not.toHaveBeenCalled();
  });

  it("still rolls the optimistic value back", async () => {
    const onSave = vi.fn().mockResolvedValue({ status: "conflict", message: "Taken." });
    render(
      <EditableField
        label="Name"
        value="Todo"
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    const input = await screen.findByRole("textbox", { name: "Name" });
    fireEvent.change(input, { target: { value: "Backlog" } });
    fireEvent.blur(input);

    await waitFor(() => expect(screen.getByRole("button", { name: "Name" }).textContent).toBe("Todo"));
  });

  it("clears the conflict message when the field is opened again", async () => {
    const onSave = vi.fn().mockResolvedValue({ status: "conflict", message: "Taken." });
    render(
      <EditableField
        label="Name"
        value="Todo"
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Name" }));
    fireEvent.change(await screen.findByRole("textbox", { name: "Name" }), {
      target: { value: "Backlog" },
    });
    fireEvent.blur(screen.getByRole("textbox", { name: "Name" }));
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: "Name" }));

    expect(screen.queryByRole("alert")).toBeNull();
  });
});