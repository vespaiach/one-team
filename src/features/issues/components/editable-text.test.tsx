import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditableText } from "./editable-text";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EditableText — the in-place gesture (FR-048, OT-UX-009)", () => {
  it("turns the value into a focused field when clicked", async () => {
    const updateIssueAction = vi.fn();
    render(
      <EditableText
        label="Title"
        field="title"
        issueId="issue-1"
        value="Fix the header"
        maxLength={200}
        updateIssueAction={updateIssueAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Title" }));

    const field = await screen.findByRole("textbox", { name: "Title" });
    expect((field as HTMLInputElement).value).toBe("Fix the header");
    expect(document.activeElement).toBe(field);
  });

  it("enters edit mode from the keyboard alone", async () => {
    const updateIssueAction = vi.fn();
    render(
      <EditableText
        label="Title"
        field="title"
        issueId="issue-1"
        value="Fix the header"
        maxLength={200}
        updateIssueAction={updateIssueAction}
      />,
    );

    const button = screen.getByRole("button", { name: "Title" });
    button.focus();
    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.keyUp(button, { key: "Enter" });

    expect(await screen.findByRole("textbox", { name: "Title" })).not.toBeNull();
  });

  it("reverts to the saved value and writes nothing on Escape", async () => {
    const updateIssueAction = vi.fn();
    render(
      <EditableText
        label="Title"
        field="title"
        issueId="issue-1"
        value="Fix the header"
        maxLength={200}
        updateIssueAction={updateIssueAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Title" }));
    const field = await screen.findByRole("textbox", { name: "Title" });
    fireEvent.change(field, { target: { value: "Something else" } });
    fireEvent.keyDown(field, { key: "Escape" });

    const button = await screen.findByRole("button", { name: "Title" });
    expect(button.textContent).toBe("Fix the header");
    expect(updateIssueAction).not.toHaveBeenCalled();
  });

  it("returns focus to the value after Escape", async () => {
    const updateIssueAction = vi.fn();
    render(
      <EditableText
        label="Title"
        field="title"
        issueId="issue-1"
        value="Fix the header"
        maxLength={200}
        updateIssueAction={updateIssueAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Title" }));
    const field = await screen.findByRole("textbox", { name: "Title" });
    fireEvent.keyDown(field, { key: "Escape" });

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Title" })));
  });

  it("saves on blur, exactly once", async () => {
    const updateIssueAction = vi.fn().mockResolvedValue({ status: "ok" });
    render(
      <EditableText
        label="Title"
        field="title"
        issueId="issue-1"
        value="Fix the header"
        maxLength={200}
        updateIssueAction={updateIssueAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Title" }));
    const field = await screen.findByRole("textbox", { name: "Title" });
    fireEvent.change(field, { target: { value: "Fix the footer" } });
    fireEvent.blur(field);

    await waitFor(() => expect(updateIssueAction).toHaveBeenCalledTimes(1));
    expect(updateIssueAction).toHaveBeenCalledWith({ issueId: "issue-1", title: "Fix the footer" });
  });

  it("saves on the platform's command modifier with Enter, without waiting for blur", async () => {
    const updateIssueAction = vi.fn().mockResolvedValue({ status: "ok" });
    render(
      <EditableText
        label="Description"
        field="description"
        issueId="issue-1"
        value="Original"
        multiline
        maxLength={10000}
        updateIssueAction={updateIssueAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Description" }));
    const field = await screen.findByRole("textbox", { name: "Description" });
    fireEvent.change(field, { target: { value: "Changed" } });
    fireEvent.keyDown(field, { key: "Enter", metaKey: true });

    await waitFor(() => expect(updateIssueAction).toHaveBeenCalledTimes(1));
    expect(updateIssueAction).toHaveBeenCalledWith({ issueId: "issue-1", description: "Changed" });
  });

  it("saves on Ctrl+Enter for a platform with no Cmd key", async () => {
    const updateIssueAction = vi.fn().mockResolvedValue({ status: "ok" });
    render(
      <EditableText
        label="Description"
        field="description"
        issueId="issue-1"
        value="Original"
        multiline
        maxLength={10000}
        updateIssueAction={updateIssueAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Description" }));
    const field = await screen.findByRole("textbox", { name: "Description" });
    fireEvent.change(field, { target: { value: "Changed" } });
    fireEvent.keyDown(field, { key: "Enter", ctrlKey: true });

    await waitFor(() => expect(updateIssueAction).toHaveBeenCalledTimes(1));
    expect(updateIssueAction).toHaveBeenCalledWith({ issueId: "issue-1", description: "Changed" });
  });

  it("makes no call on a blur whose value matches the one the field opened with", async () => {
    const updateIssueAction = vi.fn();
    render(
      <EditableText
        label="Title"
        field="title"
        issueId="issue-1"
        value="Fix the header"
        maxLength={200}
        updateIssueAction={updateIssueAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Title" }));
    const field = await screen.findByRole("textbox", { name: "Title" });
    fireEvent.blur(field);

    await screen.findByRole("button", { name: "Title" });
    expect(updateIssueAction).not.toHaveBeenCalled();
  });

  it("returns focus to the value after a save", async () => {
    const updateIssueAction = vi.fn().mockResolvedValue({ status: "ok" });
    render(
      <EditableText
        label="Title"
        field="title"
        issueId="issue-1"
        value="Fix the header"
        maxLength={200}
        updateIssueAction={updateIssueAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Title" }));
    const field = await screen.findByRole("textbox", { name: "Title" });
    fireEvent.change(field, { target: { value: "Fix the footer" } });
    fireEvent.blur(field);

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Title" })));
  });

  it("returns focus to the value when the server refuses the save", async () => {
    const updateIssueAction = vi
      .fn()
      .mockResolvedValue({ status: "invalid", field: "title", reason: "too-long" });
    render(
      <EditableText
        label="Title"
        field="title"
        issueId="issue-1"
        value="Fix the header"
        maxLength={200}
        updateIssueAction={updateIssueAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Title" }));
    const field = await screen.findByRole("textbox", { name: "Title" });
    fireEvent.change(field, { target: { value: "Fix the footer" } });
    fireEvent.blur(field);

    await waitFor(() => expect(updateIssueAction).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Title" })));
  });
});