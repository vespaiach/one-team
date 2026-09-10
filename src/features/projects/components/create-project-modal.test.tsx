import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}));

import type { RosterEntry } from "../server/queries";
import { CreateProjectModal } from "./create-project-modal";

const candidates: RosterEntry[] = [
  { userId: "u1", displayName: "Ada Lovelace", avatarUrl: null, jobTitle: null, deactivated: false },
];

describe("CreateProjectModal", () => {
  it("is closed until its trigger is pressed", () => {
    render(
      <CreateProjectModal
        createProjectAction={vi.fn()}
        checkKeyAvailability={vi.fn()}
        candidates={candidates}
      />,
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("button", { name: /new project/i })).not.toBeNull();
  });

  it("opens the create-project form in a dialog when pressed, and closes it on Cancel", () => {
    render(
      <CreateProjectModal
        createProjectAction={vi.fn()}
        checkKeyAvailability={vi.fn().mockResolvedValue({ holder: null })}
        candidates={candidates}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /new project/i }));
    expect(screen.getByRole("dialog")).not.toBeNull();
    expect(screen.getByLabelText("Name")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});