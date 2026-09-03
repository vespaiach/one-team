import { describe, expect, it } from "vitest";
import { parseMarkdown } from "./parse";

describe("parseMarkdown — blocks (FR-010, OT-DATA-015)", () => {
  it("parses a heading for each level 1 through 6", () => {
    for (let level = 1; level <= 6; level++) {
      const source = `${"#".repeat(level)} Heading ${level}`;
      expect(parseMarkdown(source)).toEqual([
        { type: "heading", level, inlines: [{ type: "text", text: `Heading ${level}` }] },
      ]);
    }
  });

  it("requires exactly one space after the hashes to be a heading", () => {
    expect(parseMarkdown("#NoSpace")).toEqual([
      { type: "paragraph", inlines: [{ type: "text", text: "#NoSpace" }] },
    ]);
  });

  it("does not honour a seventh hash as a heading", () => {
    expect(parseMarkdown("####### Too many")).toEqual([
      { type: "paragraph", inlines: [{ type: "text", text: "####### Too many" }] },
    ]);
  });

  it("parses consecutive dash-prefixed lines as one bullet list", () => {
    expect(parseMarkdown("- one\n- two\n- three")).toEqual([
      {
        type: "bulletList",
        items: [
          [{ type: "text", text: "one" }],
          [{ type: "text", text: "two" }],
          [{ type: "text", text: "three" }],
        ],
      },
    ]);
  });

  it("parses consecutive asterisk-prefixed lines as one bullet list", () => {
    expect(parseMarkdown("* one\n* two")).toEqual([
      {
        type: "bulletList",
        items: [[{ type: "text", text: "one" }], [{ type: "text", text: "two" }]],
      },
    ]);
  });

  it("parses consecutive digit-dot lines as one numbered list", () => {
    expect(parseMarkdown("1. one\n2. two\n3. three")).toEqual([
      {
        type: "numberedList",
        items: [
          [{ type: "text", text: "one" }],
          [{ type: "text", text: "two" }],
          [{ type: "text", text: "three" }],
        ],
      },
    ]);
  });

  it("does not honour the source's ordinals", () => {
    expect(parseMarkdown("3. one\n4. two\n5. three")).toEqual([
      {
        type: "numberedList",
        items: [
          [{ type: "text", text: "one" }],
          [{ type: "text", text: "two" }],
          [{ type: "text", text: "three" }],
        ],
      },
    ]);
  });

  it("parses a plain line as a paragraph", () => {
    expect(parseMarkdown("Just some prose.")).toEqual([
      { type: "paragraph", inlines: [{ type: "text", text: "Just some prose." }] },
    ]);
  });

  it("splits blocks on a blank line", () => {
    expect(parseMarkdown("First paragraph.\n\nSecond paragraph.")).toEqual([
      { type: "paragraph", inlines: [{ type: "text", text: "First paragraph." }] },
      { type: "paragraph", inlines: [{ type: "text", text: "Second paragraph." }] },
    ]);
  });

  it("treats an indented line as a paragraph rather than a nested item", () => {
    expect(parseMarkdown("- one\n  - nested")).toEqual([
      { type: "bulletList", items: [[{ type: "text", text: "one" }]] },
      { type: "paragraph", inlines: [{ type: "text", text: "  - nested" }] },
    ]);
  });

  for (const [label, source] of [
    ["a table row", "| a | b |"],
    ["a blockquote", "> a quote"],
    ["an indented code block", "    const x = 1;"],
    ["an HTML tag", "<div>hi</div>"],
  ] as const) {
    it(`falls through to a literal-text paragraph for ${label}`, () => {
      expect(parseMarkdown(source)).toEqual([
        { type: "paragraph", inlines: [{ type: "text", text: source }] },
      ]);
    });
  }
});

describe("parseMarkdown — inlines (FR-010, FR-011)", () => {
  it("parses bold text", () => {
    expect(parseMarkdown("**bold**")).toEqual([
      { type: "paragraph", inlines: [{ type: "bold", text: "bold" }] },
    ]);
  });

  it("parses italic text with asterisks", () => {
    expect(parseMarkdown("*italic*")).toEqual([
      { type: "paragraph", inlines: [{ type: "italic", text: "italic" }] },
    ]);
  });

  it("parses italic text with underscores", () => {
    expect(parseMarkdown("_italic_")).toEqual([
      { type: "paragraph", inlines: [{ type: "italic", text: "italic" }] },
    ]);
  });

  it("parses inline code", () => {
    expect(parseMarkdown("`code`")).toEqual([
      { type: "paragraph", inlines: [{ type: "code", text: "code" }] },
    ]);
  });

  it("parses a link", () => {
    expect(parseMarkdown("[One Team](https://example.com)")).toEqual([
      {
        type: "paragraph",
        inlines: [{ type: "link", href: "https://example.com", text: "One Team" }],
      },
    ]);
  });

  it("keeps a balanced parenthesis inside a link href", () => {
    expect(parseMarkdown("[no](javascript:alert(1))")).toEqual([
      {
        type: "paragraph",
        inlines: [{ type: "link", href: "javascript:alert(1)", text: "no" }],
      },
    ]);
  });

  it("mixes inlines with surrounding text in one paragraph", () => {
    expect(parseMarkdown("plain **bold** and *italic* and `code`")).toEqual([
      {
        type: "paragraph",
        inlines: [
          { type: "text", text: "plain " },
          { type: "bold", text: "bold" },
          { type: "text", text: " and " },
          { type: "italic", text: "italic" },
          { type: "text", text: " and " },
          { type: "code", text: "code" },
        ],
      },
    ]);
  });

  it("has inline code suppress every marker inside it", () => {
    expect(parseMarkdown("`**a**`")).toEqual([
      { type: "paragraph", inlines: [{ type: "code", text: "**a**" }] },
    ]);
  });

  it("renders an unclosed bold marker as its own literal text", () => {
    expect(parseMarkdown("**bold")).toEqual([
      { type: "paragraph", inlines: [{ type: "text", text: "**bold" }] },
    ]);
  });

  it("renders an unclosed italic marker as its own literal text", () => {
    expect(parseMarkdown("*italic")).toEqual([
      { type: "paragraph", inlines: [{ type: "text", text: "*italic" }] },
    ]);
  });

  it("renders an unclosed code marker as its own literal text", () => {
    expect(parseMarkdown("`code")).toEqual([
      { type: "paragraph", inlines: [{ type: "text", text: "`code" }] },
    ]);
  });

  it("renders an unclosed link as its own literal text", () => {
    expect(parseMarkdown("[text](unterminated")).toEqual([
      { type: "paragraph", inlines: [{ type: "text", text: "[text](unterminated" }] },
    ]);
  });

  it("does not parse markers inside a heading differently than a paragraph", () => {
    expect(parseMarkdown("# **Bold** heading")).toEqual([
      {
        type: "heading",
        level: 1,
        inlines: [
          { type: "bold", text: "Bold" },
          { type: "text", text: " heading" },
        ],
      },
    ]);
  });

  it("applies inlines inside list items", () => {
    expect(parseMarkdown("- **bold** item")).toEqual([
      {
        type: "bulletList",
        items: [
          [
            { type: "bold", text: "bold" },
            { type: "text", text: " item" },
          ],
        ],
      },
    ]);
  });
});

describe("parseMarkdown — totality", () => {
  it("produces output for an empty string", () => {
    expect(parseMarkdown("")).toEqual([]);
  });
});