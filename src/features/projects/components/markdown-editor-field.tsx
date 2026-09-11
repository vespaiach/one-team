"use client";

import clsx from "clsx";
import { useRef, useState } from "react";
import { Button } from "react-aria-components/Button";
import { Label, TextArea, TextField } from "react-aria-components/TextField";
import { flushSync } from "react-dom";
import { Markdown } from "@/components/shared/markdown/markdown";
import {
  BoldIcon,
  BulletListIcon,
  HeadingIcon,
  InlineCodeIcon,
  ItalicIcon,
  LinkIcon,
  NumberedListIcon,
} from "./icons";

type Selection = [start: number, end: number];

type ToolbarAction = {
  label: string;
  icon: typeof BoldIcon;
  apply: (value: string, selection: Selection) => { value: string; selection: Selection };
};

function wrapSelection(marker: string, placeholder: string) {
  return (value: string, [start, end]: Selection) => {
    const selected = value.slice(start, end) || placeholder;
    const nextValue = value.slice(0, start) + marker + selected + marker + value.slice(end);
    const selectionStart = start + marker.length;
    return { value: nextValue, selection: [selectionStart, selectionStart + selected.length] as Selection };
  };
}

function prefixLines(prefix: string) {
  return (value: string, [start, end]: Selection) => {
    const lineStart = value.lastIndexOf("\n", start - 1) + 1;
    const nextNewline = value.indexOf("\n", end);
    const lineEnd = nextNewline === -1 ? value.length : nextNewline;
    const segment = value.slice(lineStart, lineEnd);
    const nextSegment = segment
      .split("\n")
      .map((line) => prefix + line)
      .join("\n");
    const nextValue = value.slice(0, lineStart) + nextSegment + value.slice(lineEnd);
    const added = nextSegment.length - segment.length;
    return { value: nextValue, selection: [start + prefix.length, end + added] as Selection };
  };
}

function applyLink(value: string, [start, end]: Selection) {
  const text = value.slice(start, end) || "link text";
  const href = "https://";
  const inserted = `[${text}](${href})`;
  const nextValue = value.slice(0, start) + inserted + value.slice(end);
  const hrefStart = start + `[${text}](`.length;
  return { value: nextValue, selection: [hrefStart, hrefStart + href.length] as Selection };
}

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  { label: "Bold", icon: BoldIcon, apply: wrapSelection("**", "bold") },
  { label: "Italic", icon: ItalicIcon, apply: wrapSelection("*", "italic") },
  { label: "Code", icon: InlineCodeIcon, apply: wrapSelection("`", "code") },
  { label: "Link", icon: LinkIcon, apply: applyLink },
  { label: "Bullet list", icon: BulletListIcon, apply: prefixLines("- ") },
  { label: "Numbered list", icon: NumberedListIcon, apply: prefixLines("1. ") },
  { label: "Heading", icon: HeadingIcon, apply: prefixLines("# ") },
];

const TOOLBAR_BUTTON_CLASSES =
  "flex h-6 w-6 items-center justify-center text-(--color-text-muted) data-[hovered]:bg-(--color-chrome-tint-strong) data-[hovered]:text-(--color-text) data-[focus-visible]:outline-2 data-[focus-visible]:outline-(--color-accent)";

const MODE_TAB_CLASSES = "text-label data-[hovered]:text-(--color-text)";

export function MarkdownEditorField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [mode, setMode] = useState<"markdown" | "preview">("markdown");
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  function runAction(action: ToolbarAction) {
    const textarea = textAreaRef.current;
    if (!textarea) {
      return;
    }
    const result = action.apply(value, [textarea.selectionStart, textarea.selectionEnd]);
    flushSync(() => onChange(result.value));
    textarea.focus();
    textarea.setSelectionRange(result.selection[0], result.selection[1]);
  }

  return (
    <div className="flex flex-col border border-(--color-divider) bg-(--color-bg)">
      {mode === "markdown" ? (
        <TextField
          value={value}
          onChange={onChange}
          className="flex flex-col">
          <Label className="sr-only">Description</Label>
          <TextArea
            ref={textAreaRef}
            placeholder="What is this project for?"
            className="max-h-[280px] min-h-[120px] w-full resize-none overflow-y-auto border-0 bg-transparent px-3 py-2 text-control text-(--color-text) outline-none"
          />
        </TextField>
      ) : (
        <div className="min-h-[120px] px-3 py-2 text-control text-(--color-text)">
          <Markdown source={value} />
        </div>
      )}

      <div className="flex items-center gap-2 border-(--color-divider) border-t px-2 py-1.5">
        {mode === "markdown" ? (
          <div className="flex items-center gap-0.5">
            {TOOLBAR_ACTIONS.map((action) => (
              <Button
                key={action.label}
                type="button"
                aria-label={action.label}
                onPress={() => runAction(action)}
                className={TOOLBAR_BUTTON_CLASSES}>
                <action.icon size={15} />
              </Button>
            ))}
          </div>
        ) : null}
        <div className="ml-auto flex items-center gap-3">
          <Button
            type="button"
            onPress={() => setMode("markdown")}
            className={clsx(MODE_TAB_CLASSES, mode === "markdown" ? "text-(--color-text)" : undefined)}>
            Markdown
          </Button>
          <Button
            type="button"
            onPress={() => setMode("preview")}
            className={clsx(MODE_TAB_CLASSES, mode === "preview" ? "text-(--color-text)" : undefined)}>
            Preview
          </Button>
        </div>
      </div>
    </div>
  );
}