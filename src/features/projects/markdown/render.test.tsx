import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { isAllowedLinkHref, renderMarkdown } from "./render";

describe("renderMarkdown — HTML escaping (OT-DATA-015)", () => {
  it("renders an HTML input as text, never as markup", () => {
    const source = "<script>alert(1)</script>";
    const { container } = render(<div>{renderMarkdown(source)}</div>);

    expect(container.textContent).toBe(source);
    expect(container.querySelector("script")).toBeNull();
  });

  it("renders bidirectional-override and control characters as text", () => {
    const source = "a‮b c";
    const { container } = render(<div>{renderMarkdown(source)}</div>);

    expect(container.textContent).toBe(source);
  });
});

describe("renderMarkdown — blocks", () => {
  it("renders a heading level to its matching tag", () => {
    const { container } = render(<div>{renderMarkdown("### Heading")}</div>);

    const heading = container.querySelector("h3");
    expect(heading?.textContent).toBe("Heading");
  });

  it("renders a bullet list as ul > li", () => {
    const { container } = render(<div>{renderMarkdown("- one\n- two")}</div>);

    const list = container.querySelector("ul");
    expect(list?.querySelectorAll("li")).toHaveLength(2);
  });

  it("renders a numbered list as ol > li, renumbered from one", () => {
    const { container } = render(<div>{renderMarkdown("5. one\n6. two")}</div>);

    const list = container.querySelector("ol");
    expect(list?.querySelectorAll("li")).toHaveLength(2);
  });

  it("renders a paragraph as p", () => {
    const { container } = render(<div>{renderMarkdown("Some prose.")}</div>);

    expect(container.querySelector("p")?.textContent).toBe("Some prose.");
  });
});

describe("renderMarkdown — inlines", () => {
  it("renders bold as strong", () => {
    const { container } = render(<div>{renderMarkdown("**bold**")}</div>);
    expect(container.querySelector("strong")?.textContent).toBe("bold");
  });

  it("renders italic as em", () => {
    const { container } = render(<div>{renderMarkdown("*italic*")}</div>);
    expect(container.querySelector("em")?.textContent).toBe("italic");
  });

  it("renders inline code as code", () => {
    const { container } = render(<div>{renderMarkdown("`code`")}</div>);
    expect(container.querySelector("code")?.textContent).toBe("code");
  });
});

describe("renderMarkdown — link schemes (FR-011)", () => {
  for (const scheme of ["http://example.com", "https://example.com", "mailto:a@example.com"]) {
    it(`renders a link for the ${scheme.split(":")[0]} scheme`, () => {
      const { container } = render(<div>{renderMarkdown(`[go](${scheme})`)}</div>);

      const anchor = container.querySelector("a");
      expect(anchor?.getAttribute("href")).toBe(scheme);
      expect(anchor?.textContent).toBe("go");
      expect(anchor?.getAttribute("rel")).toBe("noopener noreferrer");
    });
  }

  const rejected: Array<[string, string]> = [
    ["JaVaScRiPt:evil", "mixed-case scheme"],
    [" javascript:evil", "leading whitespace"],
    ["/relative/path", "a relative href"],
    ["//host/path", "a protocol-relative href"],
    ["not-a-url-at-all", "an unparseable href"],
  ];

  for (const [href, label] of rejected) {
    it(`renders the link's text as plain text for ${label}`, () => {
      const { container } = render(<div>{renderMarkdown(`[go](${href})`)}</div>);

      expect(container.querySelector("a")).toBeNull();
      expect(container.textContent).toBe("go");
    });
  }
});

describe("isAllowedLinkHref — the scheme allowlist (FR-011)", () => {
  it("allows http, https and mailto", () => {
    expect(isAllowedLinkHref("http://example.com")).toBe(true);
    expect(isAllowedLinkHref("https://example.com")).toBe(true);
    expect(isAllowedLinkHref("mailto:a@example.com")).toBe(true);
  });

  it("rejects a scheme split by an embedded newline, which defeats prefix matching", () => {
    expect(isAllowedLinkHref("java\nscript:alert(1)")).toBe(false);
  });

  it("rejects a mixed-case javascript scheme", () => {
    expect(isAllowedLinkHref("JaVaScRiPt:alert(1)")).toBe(false);
  });

  it("rejects leading whitespace before the scheme", () => {
    expect(isAllowedLinkHref(" javascript:alert(1)")).toBe(false);
  });

  it("rejects an href with no scheme at all", () => {
    expect(isAllowedLinkHref("/relative/path")).toBe(false);
    expect(isAllowedLinkHref("//host/path")).toBe(false);
  });
});