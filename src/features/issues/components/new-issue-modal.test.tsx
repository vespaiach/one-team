import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NewIssueModal } from "./new-issue-modal";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), back: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("../actions", () => ({
  createIssue: vi.fn(),
}));

function renderModal(defaultOpen?: boolean) {
  return render(
    <NewIssueModal
      projectId="project-1"
      projectKey="APOLLO"
      columns={[]}
      assigneePool={[]}
      labelOptions={[]}
      canManageLabels={false}
      canWrite={true}
      writeReason=""
      defaultOpen={defaultOpen}
    />,
  );
}

describe("NewIssueModal", () => {
  it("stays closed by default", () => {
    renderModal();

    expect(screen.queryByRole("heading", { name: "New issue" })).toBeNull();
  });

  it("opens on mount when defaultOpen is set", () => {
    renderModal(true);

    expect(screen.getByRole("heading", { name: "New issue" })).toBeTruthy();
  });
});