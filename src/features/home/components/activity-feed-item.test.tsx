import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { InstallationActivityRow } from "../server/activity-queries";
import { ActivityFeedItem } from "./activity-feed-item";

const ACTOR = {
  id: "u1",
  firstName: "Grace",
  lastName: "Hopper",
  avatarUrl: null,
  role: "member",
  jobTitle: null,
  deactivatedAt: null,
};

function row(overrides: Partial<InstallationActivityRow> = {}): InstallationActivityRow {
  return {
    id: "a1",
    kind: "field_changed",
    actor: ACTOR,
    targetLabel: "APOLLO-27 · Fix the flux capacitor",
    projectName: "Apollo Platform",
    href: "/projects/APOLLO/issues/27/details",
    createdAt: new Date("2026-09-07T11:48:00Z"),
    field: "column",
    fromValue: "Todo",
    toValue: "In Progress",
    body: null,
    ...overrides,
  };
}

describe("ActivityFeedItem", () => {
  it("puts the issue key on a second indented line for an issue-scoped event", () => {
    render(<ActivityFeedItem row={row()} />);

    expect(screen.getByText(/changed column from Todo to In Progress/)).toBeTruthy();
    expect(screen.getByText("APOLLO-27")).toBeTruthy();
    expect(screen.queryByText("Fix the flux capacitor")).toBeNull();
  });

  it("keeps a member event on one line with no project name appended", () => {
    render(
      <ActivityFeedItem
        row={row({
          kind: "member_added",
          targetLabel: "Apollo Platform",
          field: null,
          fromValue: null,
          toValue: "Noor Haddad",
        })}
      />,
    );

    expect(screen.getByText(/added Noor Haddad/)).toBeTruthy();
    expect(screen.queryByText("Apollo Platform")).toBeNull();
  });

  it("appends the project name for a project-level event", () => {
    render(
      <ActivityFeedItem
        row={row({
          kind: "archived",
          targetLabel: "Customer Support Desk",
          projectName: "Customer Support Desk",
        })}
      />,
    );

    expect(screen.getByText(/archived this Customer Support Desk/)).toBeTruthy();
  });

  it("renders a comment as a quoted block instead of a phrase", () => {
    render(
      <ActivityFeedItem
        row={row({
          kind: "comment",
          field: null,
          fromValue: null,
          toValue: null,
          targetLabel: "APOLLO-27 · Fix the flux capacitor",
          body: "This one needs a design review before we commit.",
        })}
      />,
    );

    expect(screen.getByText(/commented on/)).toBeTruthy();
    expect(screen.getByText("APOLLO-27")).toBeTruthy();
    expect(screen.getByText("This one needs a design review before we commit.")).toBeTruthy();
  });
});