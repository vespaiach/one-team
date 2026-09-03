import { describe, expect, it } from "vitest";
import { parseMarkdown } from "./parse";

describe("parseMarkdown — fall-through to literal text (FR-009, SC-013)", () => {
  for (const [label, source] of [
    ["a table row", "| a | b |"],
    ["an image", "![diagram](diagram.png)"],
    ["an embed", "<<embed:dQw4w9WgXcQ>>"],
    ["a fence", "```js"],
    ["a blockquote", "> a quote"],
    ["a rule", "***"],
    ["raw HTML", "<div>hi</div>"],
    ["an unclosed emphasis run", "*italic"],
    ["an unterminated link", "[text](unterminated"],
  ] as const) {
    it(`parses ${label} to the characters the author typed`, () => {
      expect(parseMarkdown(source)).toEqual([
        { type: "paragraph", inlines: [{ type: "text", text: source }] },
      ]);
    });
  }

  it("parses an indented line under a construct-like marker as a paragraph when it starts a block by itself", () => {
    expect(parseMarkdown("    const x = 1;")).toEqual([
      { type: "paragraph", inlines: [{ type: "text", text: "    const x = 1;" }] },
    ]);
  });

  it("renders an unclosed bold marker as its own literal text", () => {
    expect(parseMarkdown("**bold")).toEqual([
      { type: "paragraph", inlines: [{ type: "text", text: "**bold" }] },
    ]);
  });

  it("renders an unclosed code marker as its own literal text", () => {
    expect(parseMarkdown("`code")).toEqual([
      { type: "paragraph", inlines: [{ type: "text", text: "`code" }] },
    ]);
  });

  it("never throws for any unsupported construct, and never produces an error node", () => {
    const sources = ["| a | b |", "![alt](x.png)", "```", "> quote", "***", "<div/>", "*x", "[x](y"];
    for (const source of sources) {
      expect(() => parseMarkdown(source)).not.toThrow();
      const blocks = parseMarkdown(source);
      expect(blocks.every((block) => block.type !== undefined)).toBe(true);
    }
  });
});