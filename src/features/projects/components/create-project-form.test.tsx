import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CreateProjectState } from "../actions";
import { CreateProjectForm } from "./create-project-form";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
}));

function noopCheckKeyAvailability() {
  return Promise.resolve({ holder: null });
}

describe("CreateProjectForm", () => {
  it("submits the form when Cmd/Ctrl+Enter is pressed", async () => {
    const createProjectAction = vi.fn((_prevState: CreateProjectState) =>
      Promise.resolve<CreateProjectState>({ status: "idle" }),
    );

    render(
      <CreateProjectForm
        createProjectAction={createProjectAction}
        checkKeyAvailability={noopCheckKeyAvailability}
        candidates={[]}
      />,
    );

    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "Apollo" } });
    fireEvent.keyDown(screen.getByLabelText("Project name"), { key: "Enter", ctrlKey: true });

    await waitFor(() => {
      expect(createProjectAction).toHaveBeenCalled();
    });
  });
});