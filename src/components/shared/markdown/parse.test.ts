import { describe, expect, it } from "vitest";
import { parseMarkdown } from "./parse";

describe("parseMarkdown — the seven constructs, exact spelling (FR-009)", () => {
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

  it("parses bold text", () => {
    expect(parseMarkdown("**bold**")).toEqual([
      { type: "paragraph", inlines: [{ type: "bold", text: "bold" }] },
    ]);
  });

  it("parses italic text with a single asterisk", () => {
    expect(parseMarkdown("*italic*")).toEqual([
      { type: "paragraph", inlines: [{ type: "italic", text: "italic" }] },
    ]);
  });

  it("parses inline code", () => {
    expect(parseMarkdown("`code`")).toEqual([
      { type: "paragraph", inlines: [{ type: "code", text: "code" }] },
    ]);
  });

  it("parses a link with an allowed scheme", () => {
    expect(parseMarkdown("[One Team](https://example.com)")).toEqual([
      {
        type: "paragraph",
        inlines: [{ type: "link", href: "https://example.com", text: "One Team" }],
      },
    ]);
  });

  it("keeps a balanced parenthesis inside an allowed-scheme link href", () => {
    expect(parseMarkdown("[wiki](https://en.wikipedia.org/wiki/Foo_(disambiguation))")).toEqual([
      {
        type: "paragraph",
        inlines: [{ type: "link", href: "https://en.wikipedia.org/wiki/Foo_(disambiguation)", text: "wiki" }],
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

describe("parseMarkdown — `_` carries no meaning at all (FR-009)", () => {
  it("renders a lone underscore-wrapped word whole, never as italic", () => {
    expect(parseMarkdown("_italic_")).toEqual([
      { type: "paragraph", inlines: [{ type: "text", text: "_italic_" }] },
    ]);
  });

  it("renders snake_case identifiers whole", () => {
    expect(parseMarkdown("created_at and updated_at")).toEqual([
      { type: "paragraph", inlines: [{ type: "text", text: "created_at and updated_at" }] },
    ]);
  });

  it("does not treat a double underscore as bold either", () => {
    expect(parseMarkdown("__bold__")).toEqual([
      { type: "paragraph", inlines: [{ type: "text", text: "__bold__" }] },
    ]);
  });
});

describe("parseMarkdown — no backslash escape (FR-009)", () => {
  it("does not let a backslash suppress an emphasis marker", () => {
    expect(parseMarkdown("\\*bold\\*")).toEqual([
      {
        type: "paragraph",
        inlines: [
          { type: "text", text: "\\" },
          { type: "italic", text: "bold\\" },
        ],
      },
    ]);
  });
});

describe("parseMarkdown — no bare-URL autolink (FR-009)", () => {
  it("renders a bare URL as plain text, never as a link", () => {
    expect(parseMarkdown("Visit https://example.com today")).toEqual([
      { type: "paragraph", inlines: [{ type: "text", text: "Visit https://example.com today" }] },
    ]);
  });
});

describe("parseMarkdown — no nesting of one inline construct inside another (FR-009)", () => {
  it("renders the inner delimiters of a bold-then-italic run literally", () => {
    expect(parseMarkdown("**bold *and italic***")).toEqual([
      {
        type: "paragraph",
        inlines: [
          { type: "bold", text: "bold *and italic" },
          { type: "text", text: "*" },
        ],
      },
    ]);
  });

  it("renders a link's label as plain text rather than parsing markers inside it", () => {
    expect(parseMarkdown("[**bold**](https://example.com)")).toEqual([
      { type: "paragraph", inlines: [{ type: "link", href: "https://example.com", text: "**bold**" }] },
    ]);
  });
});

describe("parseMarkdown — no significance to indentation before a list marker (FR-009)", () => {
  it("flattens an indented bullet item into the same list rather than nesting or rejecting it", () => {
    expect(parseMarkdown("- one\n  - two")).toEqual([
      {
        type: "bulletList",
        items: [[{ type: "text", text: "one" }], [{ type: "text", text: "two" }]],
      },
    ]);
  });

  it("flattens an indented numbered item into the same list", () => {
    expect(parseMarkdown("1. one\n   2. two")).toEqual([
      {
        type: "numberedList",
        items: [[{ type: "text", text: "one" }], [{ type: "text", text: "two" }]],
      },
    ]);
  });
});

describe("parseMarkdown — totality", () => {
  it("produces output for an empty string", () => {
    expect(parseMarkdown("")).toEqual([]);
  });
});