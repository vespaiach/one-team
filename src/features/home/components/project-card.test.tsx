import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ProjectProgressRow } from "../server/project-queries";
import { ProjectCard } from "./project-card";

function project(overrides: Partial<ProjectProgressRow> = {}): ProjectProgressRow {
  return {
    key: "APOLLO",
    name: "Apollo Platform",
    status: "active",
    href: "/projects/APOLLO",
    done: 3,
    counted: 5,
    openCount: 2,
    targetDate: "2026-12-18",
    targetPassed: false,
    members: [{ id: "1", name: "Ada Lovelace", avatarUrl: null }],
    ...overrides,
  };
}

describe("ProjectCard", () => {
  it("shows the project name, key and open count with its target date", () => {
    render(<ProjectCard project={project()} />);

    expect(screen.getByText("Apollo Platform")).toBeTruthy();
    expect(screen.getByText("APOLLO")).toBeTruthy();
    expect(screen.getByText("2 open")).toBeTruthy();
    expect(screen.getByText("18 Dec")).toBeTruthy();
  });

  it("replaces the open count with a passed-target notice once the date has slipped", () => {
    render(<ProjectCard project={project({ targetPassed: true, targetDate: "2026-07-31" })} />);

    expect(screen.getByText("Target passed 31 Jul")).toBeTruthy();
    expect(screen.queryByText("2 open")).toBeNull();
  });

  it("omits the date segment entirely when there is no target date", () => {
    render(<ProjectCard project={project({ targetDate: null })} />);

    expect(screen.getByText("2 open")).toBeTruthy();
    expect(screen.queryByText(/Dec/)).toBeNull();
  });
});