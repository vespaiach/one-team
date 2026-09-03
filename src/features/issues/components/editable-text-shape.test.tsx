import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditableText } from "./editable-text";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("EditableText — title shape: single line, required, trimmed (FR-049)", () => {
  it("renders a single-line field, not a text area", async () => {
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
    expect(field.tagName).toBe("INPUT");
  });

  it("trims surrounding whitespace before saving", async () => {
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
    fireEvent.change(field, { target: { value: "  Fix the footer  " } });
    fireEvent.blur(field);

    await waitFor(() =>
      expect(updateIssueAction).toHaveBeenCalledWith({ issueId: "issue-1", title: "Fix the footer" }),
    );
  });

  it("keeps the field open with an inline error and issues no save when the trimmed value is empty", async () => {
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
    fireEvent.change(field, { target: { value: "   " } });
    fireEvent.blur(field);

    expect(screen.getByText("Title is required.")).not.toBeNull();
    expect(screen.getByRole("textbox", { name: "Title" })).not.toBeNull();
    expect(updateIssueAction).not.toHaveBeenCalled();
  });

  it("collapses a multi-line paste to spaces and accepts it as one line rather than refusing it", async () => {
    const updateIssueAction = vi.fn().mockResolvedValue({ status: "ok" });
    render(
      <EditableText
        label="Title"
        field="title"
        issueId="issue-1"
        value=""
        maxLength={200}
        updateIssueAction={updateIssueAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Title" }));
    const field = await screen.findByRole("textbox", { name: "Title" });
    fireEvent.paste(field, { clipboardData: { getData: () => "Fix the\nheader\r\nagain" } });
    expect((field as HTMLInputElement).value).toBe("Fix the header again");

    fireEvent.blur(field);

    await waitFor(() =>
      expect(updateIssueAction).toHaveBeenCalledWith({ issueId: "issue-1", title: "Fix the header again" }),
    );
  });

  it("keeps the field open with an inline error naming the bound, and issues no save, over 200 characters", async () => {
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
    fireEvent.change(field, { target: { value: "a".repeat(201) } });
    fireEvent.blur(field);

    expect(screen.getByText(/200 characters or fewer/)).not.toBeNull();
    expect(screen.getByRole("textbox", { name: "Title" })).not.toBeNull();
    expect(updateIssueAction).not.toHaveBeenCalled();
  });
});

describe("EditableText — description shape: grows, then scrolls within itself (FR-049)", () => {
  it("renders a multi-line, growing text area", async () => {
    const updateIssueAction = vi.fn();
    render(
      <EditableText
        label="Description"
        field="description"
        issueId="issue-1"
        value="Some notes"
        multiline
        maxLength={10000}
        updateIssueAction={updateIssueAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Description" }));
    const field = await screen.findByRole("textbox", { name: "Description" });
    expect(field.tagName).toBe("TEXTAREA");
    expect(field.className).toContain("overflow-y-auto");
  });

  it("does not require a non-empty value", async () => {
    const updateIssueAction = vi.fn().mockResolvedValue({ status: "ok" });
    render(
      <EditableText
        label="Description"
        field="description"
        issueId="issue-1"
        value="Some notes"
        multiline
        maxLength={10000}
        updateIssueAction={updateIssueAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Description" }));
    const field = await screen.findByRole("textbox", { name: "Description" });
    fireEvent.change(field, { target: { value: "" } });
    fireEvent.blur(field);

    await waitFor(() =>
      expect(updateIssueAction).toHaveBeenCalledWith({ issueId: "issue-1", description: "" }),
    );
  });

  it("keeps the field open with an inline error naming the bound, and issues no save, over 10,000 characters", async () => {
    const updateIssueAction = vi.fn();
    render(
      <EditableText
        label="Description"
        field="description"
        issueId="issue-1"
        value="Some notes"
        multiline
        maxLength={10000}
        updateIssueAction={updateIssueAction}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Description" }));
    const field = await screen.findByRole("textbox", { name: "Description" });
    fireEvent.change(field, { target: { value: "a".repeat(10001) } });
    fireEvent.blur(field);

    expect(screen.getByText(/10,000 characters or fewer/)).not.toBeNull();
    expect(screen.getByRole("textbox", { name: "Description" })).not.toBeNull();
    expect(updateIssueAction).not.toHaveBeenCalled();
  });
});