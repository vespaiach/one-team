import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AssigneeOption, IssueColumnOption, IssueView } from "../server/issue-queries";
import { IssueDetail } from "./issue-detail";

function makeIssueView(overrides: Partial<IssueView> = {}): IssueView {
  const now = new Date("2026-01-15T12:00:00Z");
  return {
    id: "issue-1",
    key: "WEB-142",
    number: 142,
    title: "Fix the header",
    description: "Some description",
    column: { id: "col-1", name: "In progress" },
    priority: "high",
    assignee: null,
    dueDate: "2026-02-01",
    project: { key: "WEB", name: "Website Redesign" },
    createdBy: {
      id: "user-1",
      firstName: "Grace",
      lastName: "Hopper",
      avatarUrl: null,
      role: "member",
      jobTitle: null,
      deactivatedAt: null,
    },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const COLUMNS: IssueColumnOption[] = [{ id: "col-1", name: "In progress" }];

const ASSIGNEE_POOL: AssigneeOption[] = [
  { id: "user-2", firstName: "Alan", lastName: "Turing", avatarUrl: null, jobTitle: null },
];

const REASON = "Only project members can edit issues in Website Redesign.";

function renderNonMember(issue: IssueView = makeIssueView()) {
  return render(
    <IssueDetail
      issue={issue}
      columns={COLUMNS}
      assigneePool={ASSIGNEE_POOL}
      canWrite={false}
      writeReason={REASON}
    />,
  );
}

describe("IssueDetail — the write boundary for a non-member (FR-026, FR-051, FR-054, US4 s1)", () => {
  it("disables every rail control and carries an inline reason naming the project", () => {
    renderNonMember();

    expect(screen.getByLabelText("Column").hasAttribute("disabled")).toBe(true);
    expect(screen.getByLabelText("Priority").hasAttribute("disabled")).toBe(true);
    expect(screen.getByLabelText("Assignee").hasAttribute("disabled")).toBe(true);
    expect((screen.getByLabelText("Due date") as HTMLInputElement).disabled).toBe(true);
    expect(screen.getAllByText(REASON).length).toBeGreaterThan(0);
  });

  it("makes the title not clickable and carries the same reason", () => {
    renderNonMember();

    const titleButton = screen.getByRole("button", { name: "Title" });
    expect(titleButton.hasAttribute("disabled")).toBe(true);

    fireEvent.click(titleButton);
    expect(screen.queryByRole("textbox", { name: "Title" })).toBeNull();
  });

  it("makes the description not clickable and carries the same reason", () => {
    renderNonMember();

    const descriptionButton = screen.getByRole("button", { name: "Description" });
    expect(descriptionButton.hasAttribute("disabled")).toBe(true);

    fireEvent.click(descriptionButton);
    expect(screen.queryByRole("textbox", { name: "Description" })).toBeNull();
  });

  it("hides nothing: every field and control a member sees is still present", () => {
    renderNonMember();

    expect(screen.getByText("WEB-142")).toBeDefined();
    expect(screen.getByRole("button", { name: "Title" }).textContent).toBe("Fix the header");
    expect(screen.getByRole("button", { name: "Description" })).toBeDefined();
    expect(screen.getByLabelText("Column")).toBeDefined();
    expect(screen.getByLabelText("Priority")).toBeDefined();
    expect(screen.getByLabelText("Assignee")).toBeDefined();
    expect(screen.getByLabelText("Due date")).toBeDefined();
  });
});

describe("IssueDetail — the write boundary does not gate reading (FR-021, FR-026)", () => {
  it("still renders every field's current value for a non-member", () => {
    renderNonMember();

    expect(screen.getByLabelText("Column").textContent).toContain("In progress");
    expect(screen.getByLabelText("Priority").textContent).toContain("High");
    expect((screen.getByLabelText("Due date") as HTMLInputElement).value).toBe("2026-02-01");
  });
});