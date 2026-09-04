import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectHeader } from "./project-header";

describe("ProjectHeader (FR-056)", () => {
  it("renders the project's name as the header title, truncated visually", () => {
    render(
      <ProjectHeader
        projectKey="WR"
        name="Website Redesign"
        current="details"
      />,
    );

    const heading = screen.getByRole("heading", { level: 1, name: "Website Redesign" });
    expect(heading.className).toContain("truncate");
  });

  it("keeps both tabs fully rendered even when the name is too long for the header", () => {
    const longName = "A very very very very very very very long project name";
    render(
      <ProjectHeader
        projectKey="WR"
        name={longName}
        current="details"
      />,
    );

    expect(screen.getByRole("tab", { name: "Board" })).not.toBeNull();
    expect(screen.getByRole("tab", { name: "Details" })).not.toBeNull();
  });

  it("links the Board tab to the project's board route", () => {
    render(
      <ProjectHeader
        projectKey="WR"
        name="Website Redesign"
        current="details"
      />,
    );

    expect(screen.getByRole("tab", { name: "Board" }).getAttribute("href")).toBe("/projects/WR");
  });

  it("links the Details tab to the project's details route", () => {
    render(
      <ProjectHeader
        projectKey="WR"
        name="Website Redesign"
        current="details"
      />,
    );

    expect(screen.getByRole("tab", { name: "Details" }).getAttribute("href")).toBe("/projects/WR/details");
  });

  it("marks Details as the current tab on the details screen", () => {
    render(
      <ProjectHeader
        projectKey="WR"
        name="Website Redesign"
        current="details"
      />,
    );

    expect(screen.getByRole("tab", { name: "Details", selected: true })).not.toBeNull();
    expect(screen.queryByRole("tab", { name: "Board", selected: true })).toBeNull();
  });

  it("marks Board as the current tab on the board screen", () => {
    render(
      <ProjectHeader
        projectKey="WR"
        name="Website Redesign"
        current="board"
      />,
    );

    expect(screen.getByRole("tab", { name: "Board", selected: true })).not.toBeNull();
    expect(screen.queryByRole("tab", { name: "Details", selected: true })).toBeNull();
  });

  it("renders the header's New issue slot when given one (FR-028)", () => {
    render(
      <ProjectHeader
        projectKey="WR"
        name="Website Redesign"
        current="details"
        newIssue={<span>New issue control</span>}
      />,
    );

    expect(screen.getByText("New issue control")).not.toBeNull();
  });

  it("shows the project's own live comment count next to the tabs (FR-059)", () => {
    render(
      <ProjectHeader
        projectKey="WR"
        name="Website Redesign"
        current="details"
        commentCount={3}
      />,
    );

    expect(screen.getByText("3 comments")).not.toBeNull();
  });

  it("uses singular wording for exactly one comment (FR-059)", () => {
    render(
      <ProjectHeader
        projectKey="WR"
        name="Website Redesign"
        current="details"
        commentCount={1}
      />,
    );

    expect(screen.getByText("1 comment")).not.toBeNull();
  });

  it("shows zero comments when the project has none yet (FR-059)", () => {
    render(
      <ProjectHeader
        projectKey="WR"
        name="Website Redesign"
        current="details"
        commentCount={0}
      />,
    );

    expect(screen.getByText("0 comments")).not.toBeNull();
  });
});