import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MarkdownEditorField } from "./markdown-editor-field";

function getTextarea(): HTMLTextAreaElement {
  return screen.getByPlaceholderText("What is this project for?") as HTMLTextAreaElement;
}

function selectAll(textarea: HTMLTextAreaElement) {
  textarea.setSelectionRange(0, textarea.value.length);
}

describe("MarkdownEditorField", () => {
  it("renders the current value and reports edits", () => {
    const onChange = vi.fn();
    render(
      <MarkdownEditorField
        value="hello"
        onChange={onChange}
      />,
    );

    const textarea = getTextarea();
    expect(textarea.value).toBe("hello");

    fireEvent.change(textarea, { target: { value: "hello world" } });
    expect(onChange).toHaveBeenCalledWith("hello world");
  });

  it("wraps the selection in ** when Bold is pressed", () => {
    const onChange = vi.fn();
    render(
      <MarkdownEditorField
        value="hello"
        onChange={onChange}
      />,
    );
    selectAll(getTextarea());

    fireEvent.click(screen.getByRole("button", { name: "Bold" }));

    expect(onChange).toHaveBeenCalledWith("**hello**");
  });

  it("wraps the selection in * when Italic is pressed", () => {
    const onChange = vi.fn();
    render(
      <MarkdownEditorField
        value="hello"
        onChange={onChange}
      />,
    );
    selectAll(getTextarea());

    fireEvent.click(screen.getByRole("button", { name: "Italic" }));

    expect(onChange).toHaveBeenCalledWith("*hello*");
  });

  it("wraps the selection in backticks when Code is pressed", () => {
    const onChange = vi.fn();
    render(
      <MarkdownEditorField
        value="hello"
        onChange={onChange}
      />,
    );
    selectAll(getTextarea());

    fireEvent.click(screen.getByRole("button", { name: "Code" }));

    expect(onChange).toHaveBeenCalledWith("`hello`");
  });

  it("wraps the selection as a link when Link is pressed", () => {
    const onChange = vi.fn();
    render(
      <MarkdownEditorField
        value="hello"
        onChange={onChange}
      />,
    );
    selectAll(getTextarea());

    fireEvent.click(screen.getByRole("button", { name: "Link" }));

    expect(onChange).toHaveBeenCalledWith("[hello](https://)");
  });

  it("prefixes the current line with - when Bullet list is pressed", () => {
    const onChange = vi.fn();
    render(
      <MarkdownEditorField
        value="hello"
        onChange={onChange}
      />,
    );
    selectAll(getTextarea());

    fireEvent.click(screen.getByRole("button", { name: "Bullet list" }));

    expect(onChange).toHaveBeenCalledWith("- hello");
  });

  it("prefixes the current line with 1. when Numbered list is pressed", () => {
    const onChange = vi.fn();
    render(
      <MarkdownEditorField
        value="hello"
        onChange={onChange}
      />,
    );
    selectAll(getTextarea());

    fireEvent.click(screen.getByRole("button", { name: "Numbered list" }));

    expect(onChange).toHaveBeenCalledWith("1. hello");
  });

  it("prefixes the current line with # when Heading is pressed", () => {
    const onChange = vi.fn();
    render(
      <MarkdownEditorField
        value="hello"
        onChange={onChange}
      />,
    );
    selectAll(getTextarea());

    fireEvent.click(screen.getByRole("button", { name: "Heading" }));

    expect(onChange).toHaveBeenCalledWith("# hello");
  });

  it("inserts placeholder syntax when nothing is selected", () => {
    const onChange = vi.fn();
    render(
      <MarkdownEditorField
        value=""
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Bold" }));

    expect(onChange).toHaveBeenCalledWith("**bold**");
  });

  it("switches to a rendered preview and hides the formatting toolbar", () => {
    render(
      <MarkdownEditorField
        value="**hello**"
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));

    expect(screen.queryByPlaceholderText("What is this project for?")).toBeNull();
    expect(screen.queryByRole("button", { name: "Bold" })).toBeNull();
    expect(screen.getByText("hello").tagName).toBe("STRONG");
  });

  it("switches back to the editor when Markdown is pressed from preview", () => {
    render(
      <MarkdownEditorField
        value="hello"
        onChange={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Preview" }));
    fireEvent.click(screen.getByRole("button", { name: "Markdown" }));

    expect(getTextarea().value).toBe("hello");
  });
});