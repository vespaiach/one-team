import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Avatar } from "./avatar";

describe("Avatar", () => {
  it("renders the image with the person's name as its alt text when a URL is given", () => {
    render(
      <Avatar
        name="Grace Hopper"
        avatarUrl="https://example.com/gh.png"
      />,
    );

    const img = screen.getByRole("img", { name: "Grace Hopper" });
    expect(img.getAttribute("src")).toBe("https://example.com/gh.png");
  });

  it("falls back to initials, decorative to assistive technology, when there is no URL", () => {
    const { container } = render(
      <Avatar
        name="Grace Hopper"
        avatarUrl={null}
      />,
    );

    expect(screen.queryByRole("img")).toBeNull();
    const fallback = container.querySelector('[aria-hidden="true"]');
    expect(fallback?.textContent).toBe("GH");
  });

  it("initials a single-word name from its first two characters", () => {
    const { container } = render(
      <Avatar
        name="Madonna"
        avatarUrl={null}
      />,
    );

    expect(container.querySelector('[aria-hidden="true"]')?.textContent).toBe("MA");
  });

  it("hides the image from assistive technology when marked decorative, for use beside a visible name", () => {
    const { container } = render(
      <Avatar
        name="Grace Hopper"
        avatarUrl="https://example.com/gh.png"
        decorative
      />,
    );

    expect(screen.queryByRole("img")).toBeNull();
    const img = container.querySelector("img");
    expect(img?.getAttribute("alt")).toBe("");
    expect(img?.getAttribute("aria-hidden")).toBe("true");
  });

  it("is a circle at every size", () => {
    const { container: withUrl } = render(
      <Avatar
        name="Grace Hopper"
        avatarUrl="https://example.com/gh.png"
      />,
    );
    expect(withUrl.querySelector("img")?.className).toContain("rounded-full");

    const { container: withoutUrl } = render(
      <Avatar
        name="Grace Hopper"
        avatarUrl={null}
        size="sm"
      />,
    );
    expect(withoutUrl.querySelector('[aria-hidden="true"]')?.className).toContain("rounded-full");
  });
});