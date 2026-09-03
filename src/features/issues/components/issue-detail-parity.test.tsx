import { render, within } from "@testing-library/react";
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
const ASSIGNEE_POOL: AssigneeOption[] = [];
const REASON = "Only project members can edit issues in Website Redesign.";

const LABELS = ["Title", "Description", "Column", "Priority", "Assignee", "Due date"];

function renderScreen(canWrite: boolean) {
  return render(
    <IssueDetail
      issue={makeIssueView()}
      columns={COLUMNS}
      assigneePool={ASSIGNEE_POOL}
      canWrite={canWrite}
      writeReason={canWrite ? "" : REASON}
    />,
  );
}

function presentControlKinds(container: HTMLElement): (string | null)[] {
  const scope = within(container);
  return LABELS.map((label) => {
    const element = scope.queryByLabelText(label);
    return element ? element.tagName.toLowerCase() : null;
  });
}

function isDisabled(element: Element): boolean {
  return (element as HTMLButtonElement | HTMLInputElement | HTMLSelectElement).disabled === true;
}

describe("IssueDetail — identical structure for every user (FR-047, SC-012, US4 s1)", () => {
  it("renders the same control for the same label, in the same order, for a member and a non-member", () => {
    const member = renderScreen(true);
    const memberKinds = presentControlKinds(member.container);
    member.unmount();

    const nonMember = renderScreen(false);
    const nonMemberKinds = presentControlKinds(nonMember.container);
    nonMember.unmount();

    expect(nonMemberKinds).toEqual(memberKinds);
    expect(memberKinds.every((kind) => kind !== null)).toBe(true);
  });

  it("differs from the member's render only in which controls are enabled, never in which are present", () => {
    const member = renderScreen(true);
    const memberDisabled = LABELS.map((label) => isDisabled(within(member.container).getByLabelText(label)));
    member.unmount();

    const nonMember = renderScreen(false);
    const nonMemberDisabled = LABELS.map((label) =>
      isDisabled(within(nonMember.container).getByLabelText(label)),
    );
    nonMember.unmount();

    expect(memberDisabled).toEqual(LABELS.map(() => false));
    expect(nonMemberDisabled).toEqual(LABELS.map(() => true));
  });

  it("renders the same structure again for an admin, who also carries canWrite true", () => {
    const member = renderScreen(true);
    const memberKinds = presentControlKinds(member.container);
    member.unmount();

    const admin = renderScreen(true);
    const adminKinds = presentControlKinds(admin.container);
    admin.unmount();

    expect(adminKinds).toEqual(memberKinds);
  });

  it("never turns the title or description from a button into plain text for a non-member", () => {
    const member = renderScreen(true);
    const memberTitle = within(member.container).getByLabelText("Title");
    const memberDescription = within(member.container).getByLabelText("Description");
    const memberTitleIsButton = memberTitle.tagName.toLowerCase() === "button";
    const memberDescriptionIsButton = memberDescription.tagName.toLowerCase() === "button";
    member.unmount();

    const nonMember = renderScreen(false);
    const nonMemberTitle = within(nonMember.container).getByLabelText("Title");
    const nonMemberDescription = within(nonMember.container).getByLabelText("Description");
    const nonMemberTitleIsButton = nonMemberTitle.tagName.toLowerCase() === "button";
    const nonMemberDescriptionIsButton = nonMemberDescription.tagName.toLowerCase() === "button";
    nonMember.unmount();

    expect(memberTitleIsButton).toBe(true);
    expect(nonMemberTitleIsButton).toBe(true);
    expect(memberDescriptionIsButton).toBe(true);
    expect(nonMemberDescriptionIsButton).toBe(true);
  });

  it("no rail control is absent for the non-member that is present for the member", () => {
    const member = renderScreen(true);
    const memberHasEach = ["Column", "Priority", "Assignee", "Due date"].map(
      (label) => within(member.container).queryByLabelText(label) !== null,
    );
    member.unmount();

    const nonMember = renderScreen(false);
    const nonMemberHasEach = ["Column", "Priority", "Assignee", "Due date"].map(
      (label) => within(nonMember.container).queryByLabelText(label) !== null,
    );
    nonMember.unmount();

    expect(nonMemberHasEach).toEqual(memberHasEach);
    expect(memberHasEach.every(Boolean)).toBe(true);
  });
});