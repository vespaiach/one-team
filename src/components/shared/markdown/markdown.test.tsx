import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "./markdown";

describe("<Markdown /> — HTML escaping (OT-DATA-015)", () => {
  it("renders an HTML input as text, never as markup", () => {
    const source = "<script>alert(1)</script>";
    const { container } = render(<Markdown source={source} />);

    expect(container.textContent).toBe(source);
    expect(container.querySelector("script")).toBeNull();
  });

  it("renders a bold-looking HTML tag as literal visible text, with no bold applied", () => {
    const { container } = render(<Markdown source="<b>hi</b>" />);

    expect(container.textContent).toBe("<b>hi</b>");
    expect(container.querySelector("b")).toBeNull();
  });

  it("renders bidirectional-override and control characters as text", () => {
    const source = "a‮b c";
    const { container } = render(<Markdown source={source} />);

    expect(container.textContent).toBe(source);
  });

  it("never calls dangerouslySetInnerHTML anywhere in the module", () => {
    const source = readFileSync(join(__dirname, "markdown.tsx"), "utf8");
    expect(source).not.toContain("dangerouslySetInnerHTML");
  });
});

describe("<Markdown /> — each construct renders as its own element", () => {
  it("renders a heading level to its matching tag", () => {
    const { container } = render(<Markdown source="### Heading" />);

    const heading = container.querySelector("h3");
    expect(heading?.textContent).toBe("Heading");
  });

  it("renders a bullet list as ul > li", () => {
    const { container } = render(<Markdown source={"- one\n- two"} />);

    const list = container.querySelector("ul");
    expect(list?.querySelectorAll("li")).toHaveLength(2);
  });

  it("renders a numbered list as ol > li, renumbered from one", () => {
    const { container } = render(<Markdown source={"5. one\n6. two"} />);

    const list = container.querySelector("ol");
    expect(list?.querySelectorAll("li")).toHaveLength(2);
  });

  it("renders a paragraph as p", () => {
    const { container } = render(<Markdown source="Some prose." />);

    expect(container.querySelector("p")?.textContent).toBe("Some prose.");
  });

  it("renders bold as strong", () => {
    const { container } = render(<Markdown source="**bold**" />);
    expect(container.querySelector("strong")?.textContent).toBe("bold");
  });

  it("renders italic as em", () => {
    const { container } = render(<Markdown source="*italic*" />);
    expect(container.querySelector("em")?.textContent).toBe("italic");
  });

  it("renders inline code as code", () => {
    const { container } = render(<Markdown source="`code`" />);
    expect(container.querySelector("code")?.textContent).toBe("code");
  });

  it("renders an allowed-scheme link as a clickable anchor", () => {
    const { container } = render(<Markdown source="[go](https://example.com)" />);

    const anchor = container.querySelector("a");
    expect(anchor?.getAttribute("href")).toBe("https://example.com");
    expect(anchor?.textContent).toBe("go");
    expect(anchor?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("renders a rejected-scheme link as its literal source text, with no anchor", () => {
    const { container } = render(<Markdown source="[go](javascript:evil)" />);

    expect(container.querySelector("a")).toBeNull();
    expect(container.textContent).toBe("[go](javascript:evil)");
  });
});