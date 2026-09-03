import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LabelFormState } from "../actions";
import type { DeleteLabelResult } from "../server/delete-label";
import type { LabelView } from "../server/queries";
import { LabelsScreen } from "./labels-screen";

function renderScreen(labels: LabelView[]) {
  const createLabelAction =
    vi.fn<(prevState: LabelFormState, input: { name: string }) => Promise<LabelFormState>>();
  const updateLabelAction =
    vi.fn<(prevState: LabelFormState, input: { id: string; name: string }) => Promise<LabelFormState>>();
  const checkNameAvailable = vi.fn().mockResolvedValue({ holder: null });
  const deleteLabelAction = vi.fn<(id: string) => Promise<DeleteLabelResult>>();

  render(
    <LabelsScreen
      labels={labels}
      createLabelAction={createLabelAction}
      updateLabelAction={updateLabelAction}
      checkNameAvailable={checkNameAvailable}
      deleteLabelAction={deleteLabelAction}
    />,
  );

  return { createLabelAction, updateLabelAction, checkNameAvailable, deleteLabelAction };
}

describe("LabelsScreen (FR-003, FR-004, FR-005)", () => {
  it("shows the single quiet line 'No labels yet' when there are none, in place of a table", () => {
    renderScreen([]);

    expect(screen.getByText("No labels yet")).not.toBeNull();
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("renders a New label control at the page's head regardless of whether any labels exist", () => {
    renderScreen([]);

    expect(screen.getByRole("button", { name: /new label/i })).not.toBeNull();
  });

  it("renders one row per label, each showing its name and issue count with Edit and Delete controls", () => {
    renderScreen([
      { id: "l1", name: "Bug", issueCount: 3 },
      { id: "l2", name: "Feature", issueCount: 0 },
    ]);

    const table = screen.getByRole("table");
    expect(table).not.toBeNull();

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(2);

    expect(screen.getByText("Bug")).not.toBeNull();
    expect(screen.getByText("Feature")).not.toBeNull();
    expect(screen.getByText("3")).not.toBeNull();

    const editButtons = screen.getAllByRole("button", { name: /^edit$/i });
    const deleteButtons = screen.getAllByRole("button", { name: /^delete$/i });
    expect(editButtons).toHaveLength(2);
    expect(deleteButtons).toHaveLength(2);
  });
});