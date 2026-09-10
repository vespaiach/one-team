import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NewWorkspaceState } from "./new-workspace-state";

describe("NewWorkspaceState", () => {
  it("offers admin actions and no member notice for an admin viewer", () => {
    render(
      <NewWorkspaceState
        isAdmin={true}
        createProjectModal={<button type="button">New project</button>}
      />,
    );

    expect(screen.getByText("Nothing filed yet")).toBeTruthy();
    expect(screen.getByRole("button", { name: "New project" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Invite teammates" })).toBeTruthy();
    expect(screen.queryByText(/admin work/)).toBeNull();
  });

  it("explains that projects are admin work, with no admin actions, for a non-admin viewer", () => {
    render(
      <NewWorkspaceState
        isAdmin={false}
        createProjectModal={null}
      />,
    );

    expect(screen.getByText(/admin work/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "New project" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Invite teammates" })).toBeNull();
  });

  it("lists what will land on this page once the workspace has data", () => {
    render(
      <NewWorkspaceState
        isAdmin={false}
        createProjectModal={null}
      />,
    );

    expect(screen.getByText("Assigned to you")).toBeTruthy();
    expect(screen.getByText("Projects")).toBeTruthy();
    expect(screen.getByText("Team activity")).toBeTruthy();
  });
});