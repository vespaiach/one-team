import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectListRegion, type ProjectListRegionEntry } from "./project-list-region";

function project(
  overrides: Partial<ProjectListRegionEntry> & { key: string; name: string },
): ProjectListRegionEntry {
  return { status: "active", openCount: 0, done: 0, counted: 0, ...overrides };
}

describe("ProjectListRegion", () => {
  it("shows a placeholder row when there are no active projects", () => {
    render(
      <ProjectListRegion
        isAdmin={false}
        entries={[]}
      />,
    );

    expect(screen.getByText("No projects yet")).toBeTruthy();
  });

  it("caps visible projects at four and reports the rest as an overflow count", () => {
    const entries = Array.from({ length: 6 }, (_, index) =>
      project({ key: `P${index}`, name: `Project ${index}` }),
    );

    render(
      <ProjectListRegion
        isAdmin={false}
        entries={entries}
      />,
    );

    expect(screen.getByText("Project 0")).toBeTruthy();
    expect(screen.getByText("Project 3")).toBeTruthy();
    expect(screen.queryByText("Project 4")).toBeNull();
    expect(screen.getByText("2 more…")).toBeTruthy();
  });

  it("excludes archived projects from the count and the list", () => {
    render(
      <ProjectListRegion
        isAdmin={false}
        entries={[
          project({ key: "A", name: "Active One" }),
          project({ key: "B", name: "Archived One", status: "archived" }),
        ]}
      />,
    );

    expect(screen.getByText(/Projects/)).toBeTruthy();
    expect(screen.getByText("1")).toBeTruthy();
    expect(screen.queryByText("Archived One")).toBeNull();
  });

  it("only shows the new-project control to admins", () => {
    const entries = [project({ key: "A", name: "Active One" })];

    const { rerender } = render(
      <ProjectListRegion
        isAdmin={false}
        entries={entries}
      />,
    );
    expect(screen.queryByLabelText("New project")).toBeNull();

    rerender(
      <ProjectListRegion
        isAdmin={true}
        entries={entries}
      />,
    );
    expect(screen.getByLabelText("New project")).toBeTruthy();
  });
});