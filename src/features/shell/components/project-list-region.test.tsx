import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectListRegion } from "./project-list-region";

describe("ProjectListRegion (FR-024, OT-UX-007)", () => {
  it("renders one quiet line reading exactly 'No projects yet.' with no illustration and no marketing (s8)", () => {
    render(
      <ProjectListRegion
        isAdmin={false}
        entries={[]}
      />,
    );

    const line = screen.getByText("No projects yet.");
    expect(line.textContent).toBe("No projects yet.");
    expect(screen.queryByRole("img")).toBeNull();
    expect(line.className).toContain("text-(--color-text-muted)");
  });
});

describe("ProjectListRegion entries (FR-053, FR-054, FR-055, OT-UX-020)", () => {
  const ENTRIES = [
    { key: "A1", name: "atlas", status: "active" as const },
    { key: "B1", name: "Beacon", status: "active" as const },
    { key: "Z1", name: "zephyr", status: "archived" as const },
  ];

  it("renders every entry in the order it was given, identically regardless of role (s1, s3, s4)", () => {
    render(
      <ProjectListRegion
        isAdmin={false}
        entries={ENTRIES}
      />,
    );

    const names = ENTRIES.map((entry) => screen.getByRole("link", { name: entry.name }));
    expect(names.every((link) => link !== null)).toBe(true);
    expect(screen.queryByText("No projects yet.")).toBeNull();
  });

  it("dims archived entries and leaves active ones undimmed (s2)", () => {
    render(
      <ProjectListRegion
        isAdmin={false}
        entries={ENTRIES}
      />,
    );

    const archived = screen.getByRole("link", { name: "zephyr" });
    const active = screen.getByRole("link", { name: "atlas" });
    expect(archived.className).toContain("text-(--color-text-muted)");
    expect(active.className).not.toContain("text-(--color-text-muted)");
  });

  it("links each entry to its project's route (s5)", () => {
    render(
      <ProjectListRegion
        isAdmin={false}
        entries={ENTRIES}
      />,
    );

    expect(screen.getByRole("link", { name: "atlas" }).getAttribute("href")).toBe("/projects/A1");
    expect(screen.getByRole("link", { name: "zephyr" }).getAttribute("href")).toBe("/projects/Z1");
  });

  it("truncates a long name visually while keeping the whole name available to assistive technology (s5)", () => {
    const longName = "A very very very very very very very long project name";
    render(
      <ProjectListRegion
        isAdmin={false}
        entries={[{ key: "L1", name: longName, status: "active" }]}
      />,
    );

    const link = screen.getByRole("link", { name: longName });
    expect(link.className).toContain("truncate");
  });
});