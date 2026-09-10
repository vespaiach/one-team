import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CreateProjectState } from "../actions";
import { CreateProjectModal } from "./create-project-modal";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
}));

function noopCreateProjectAction(): Promise<CreateProjectState> {
  return Promise.resolve({ status: "idle" });
}

function noopCheckKeyAvailability() {
  return Promise.resolve({ holder: null });
}

describe("CreateProjectModal", () => {
  it("renders a default text trigger when none is supplied", () => {
    render(
      <CreateProjectModal
        createProjectAction={noopCreateProjectAction}
        checkKeyAvailability={noopCheckKeyAvailability}
        candidates={[]}
      />,
    );

    expect(screen.getByRole("button", { name: "New project" })).toBeTruthy();
  });

  it("renders a custom trigger in place of the default when supplied", () => {
    render(
      <CreateProjectModal
        createProjectAction={noopCreateProjectAction}
        checkKeyAvailability={noopCheckKeyAvailability}
        candidates={[]}
        trigger={<button type="button">Custom trigger</button>}
      />,
    );

    expect(screen.getByRole("button", { name: "Custom trigger" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "New project" })).toBeNull();
  });

  it("opens the create-project dialog when the trigger is activated", () => {
    render(
      <CreateProjectModal
        createProjectAction={noopCreateProjectAction}
        checkKeyAvailability={noopCheckKeyAvailability}
        candidates={[]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "New project" }));

    expect(screen.getByRole("heading", { name: "New project" })).toBeTruthy();
  });
});