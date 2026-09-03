import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { IssueDescription } from "./issue-description";

describe("IssueDescription (FR-044, US2 s2, s3)", () => {
  it("renders markdown on read", () => {
    const { container } = render(<IssueDescription description="**bold** text" />);

    expect(container.querySelector("strong")?.textContent).toBe("bold");
  });

  it("renders nothing visible when the description is null", () => {
    const { container } = render(<IssueDescription description={null} />);

    expect(container.textContent).toBe("");
  });

  it("renders nothing visible when the description is an empty string, indistinguishably from null", () => {
    const nullRender = render(<IssueDescription description={null} />);
    const emptyRender = render(<IssueDescription description="" />);

    expect(emptyRender.container.textContent).toBe(nullRender.container.textContent);
    expect(emptyRender.container.textContent).toBe("");
  });

  it("offers no preview pane and no formatting toolbar", () => {
    const { queryByRole } = render(<IssueDescription description="Some text" />);

    expect(queryByRole("tablist")).toBeNull();
    expect(queryByRole("toolbar")).toBeNull();
    expect(queryByRole("textbox")).toBeNull();
  });
});