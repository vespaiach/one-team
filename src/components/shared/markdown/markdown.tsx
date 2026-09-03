import type { ReactNode } from "react";
import type { BlockNode, InlineNode } from "./parse";
import { parseMarkdown } from "./parse";

const HEADING_TAGS = {
  1: "h1",
  2: "h2",
  3: "h3",
  4: "h4",
  5: "h5",
  6: "h6",
} as const;

function renderInline(inline: InlineNode, key: number): ReactNode {
  switch (inline.type) {
    case "text":
      return inline.text;
    case "bold":
      return <strong key={key}>{inline.text}</strong>;
    case "italic":
      return <em key={key}>{inline.text}</em>;
    case "code":
      return <code key={key}>{inline.text}</code>;
    case "link":
      return (
        <a
          key={key}
          href={inline.href}
          rel="noopener noreferrer">
          {inline.text}
        </a>
      );
  }
}

function renderInlines(inlines: InlineNode[]): ReactNode[] {
  return inlines.map((inline, index) => renderInline(inline, index));
}

function renderBlock(block: BlockNode, key: number): ReactNode {
  switch (block.type) {
    case "heading": {
      const Tag = HEADING_TAGS[block.level];
      return <Tag key={key}>{renderInlines(block.inlines)}</Tag>;
    }
    case "paragraph":
      return <p key={key}>{renderInlines(block.inlines)}</p>;
    case "bulletList":
      return (
        <ul key={key}>
          {block.items.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the parsed item list is immutable and never reorders
            <li key={index}>{renderInlines(item)}</li>
          ))}
        </ul>
      );
    case "numberedList":
      return (
        <ol key={key}>
          {block.items.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the parsed item list is immutable and never reorders
            <li key={index}>{renderInlines(item)}</li>
          ))}
        </ol>
      );
  }
}

export function Markdown({ source }: { source: string }): ReactNode {
  return parseMarkdown(source).map((block, index) => renderBlock(block, index));
}