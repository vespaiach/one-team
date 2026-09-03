import { describe, expect, it } from "vitest";
import { parseMarkdown } from "./parse";

describe("parseMarkdown — the link scheme allowlist is decided at parse time (FR-010, research C-6)", () => {
  for (const scheme of ["http://example.com", "https://example.com", "mailto:a@example.com"]) {
    it(`turns a ${scheme.split(":")[0]} href into a link node`, () => {
      expect(parseMarkdown(`[go](${scheme})`)).toEqual([
        { type: "paragraph", inlines: [{ type: "link", href: scheme, text: "go" }] },
      ]);
    });
  }

  const rejected: Array<[string, string]> = [
    ["javascript:alert(1)", "a javascript href"],
    ["data:text/html,evil", "a data href"],
    ["file:///etc/passwd", "a file href"],
    ["//host/path", "a scheme-relative href"],
    ["", "an empty href"],
    ["JaVaScRiPt:alert(1)", "a mixed-case javascript scheme"],
    ["/relative/path", "a relative href with no scheme"],
  ];

  for (const [href, label] of rejected) {
    it(`turns the whole construct into a text node carrying the source characters for ${label}`, () => {
      const source = `[go](${href})`;
      expect(parseMarkdown(source)).toEqual([
        { type: "paragraph", inlines: [{ type: "text", text: source }] },
      ]);
    });
  }

  it("rejects a scheme split by an embedded tab, which defeats naive prefix matching", () => {
    const source = "[go](java\tscript:alert(1))";
    expect(parseMarkdown(source)).toEqual([{ type: "paragraph", inlines: [{ type: "text", text: source }] }]);
  });

  it("keeps a balanced parenthesis inside a rejected-scheme href as part of the literal text", () => {
    const source = "[no](javascript:alert(1))";
    expect(parseMarkdown(source)).toEqual([{ type: "paragraph", inlines: [{ type: "text", text: source }] }]);
  });

  it("does not let a rejected link's surrounding text merge incorrectly with adjacent text", () => {
    expect(parseMarkdown("before [go](javascript:evil) after")).toEqual([
      { type: "paragraph", inlines: [{ type: "text", text: "before [go](javascript:evil) after" }] },
    ]);
  });
});