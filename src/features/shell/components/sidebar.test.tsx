import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CreateProjectState } from "@/features/projects/actions";
import { Sidebar } from "./sidebar";

let mockedPathname = "/home";
vi.mock("next/navigation", () => ({
  usePathname: () => mockedPathname,
}));

const WORK_COUNTS = { openIssues: 12, assignedToMe: 3, unreadNotifications: 2 };

function noopCreateProjectAction(): Promise<CreateProjectState> {
  return Promise.resolve({ status: "idle" });
}

function noopCheckKeyAvailability() {
  return Promise.resolve({ holder: null });
}

const PROJECT_MODAL_PROPS = {
  createProjectAction: noopCreateProjectAction,
  checkKeyAvailability: noopCheckKeyAvailability,
  projectCandidates: [],
};

describe("Sidebar", () => {
  it("marks the current page with aria-current, not a class", () => {
    mockedPathname = "/home";
    render(
      <Sidebar
        displayName="Ada Lovelace"
        avatarUrl={null}
        isAdmin={false}
        projects={[]}
        activeMemberCount={10}
        workCounts={WORK_COUNTS}
        adminCounts={null}
        {...PROJECT_MODAL_PROPS}
      />,
    );

    expect(screen.getByRole("link", { name: /Home/ }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: /Notifications/ }).getAttribute("aria-current")).toBeNull();
  });

  it("shows the plural member count and the work counts", () => {
    render(
      <Sidebar
        displayName="Ada Lovelace"
        avatarUrl={null}
        isAdmin={false}
        projects={[]}
        activeMemberCount={10}
        workCounts={WORK_COUNTS}
        adminCounts={null}
        {...PROJECT_MODAL_PROPS}
      />,
    );

    expect(screen.getByText("10 members")).toBeTruthy();
    expect(screen.getByText("12")).toBeTruthy();
    expect(screen.getByText("3")).toBeTruthy();
    expect(screen.getByText("2")).toBeTruthy();
  });

  it("shows the singular member count for a workspace of one", () => {
    render(
      <Sidebar
        displayName="Ada Lovelace"
        avatarUrl={null}
        isAdmin={false}
        projects={[]}
        activeMemberCount={1}
        workCounts={WORK_COUNTS}
        adminCounts={null}
        {...PROJECT_MODAL_PROPS}
      />,
    );

    expect(screen.getByText("1 member")).toBeTruthy();
  });

  it("hides the admin group entirely for a non-admin viewer", () => {
    render(
      <Sidebar
        displayName="Ada Lovelace"
        avatarUrl={null}
        isAdmin={false}
        projects={[]}
        activeMemberCount={10}
        workCounts={WORK_COUNTS}
        adminCounts={null}
        {...PROJECT_MODAL_PROPS}
      />,
    );

    expect(screen.queryByText("Accounts")).toBeNull();
    expect(screen.queryByText("Labels")).toBeNull();
  });

  it("shows the admin group with counts for an admin viewer", () => {
    render(
      <Sidebar
        displayName="Ada Lovelace"
        avatarUrl={null}
        isAdmin={true}
        projects={[]}
        activeMemberCount={10}
        workCounts={WORK_COUNTS}
        adminCounts={{ accounts: 10, labels: 6 }}
        {...PROJECT_MODAL_PROPS}
      />,
    );

    expect(screen.getByRole("link", { name: /Accounts/ })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Labels/ })).toBeTruthy();
  });

  it("shows the viewer's name in the footer", () => {
    render(
      <Sidebar
        displayName="Ada Lovelace"
        avatarUrl={null}
        isAdmin={false}
        projects={[]}
        activeMemberCount={10}
        workCounts={WORK_COUNTS}
        adminCounts={null}
        {...PROJECT_MODAL_PROPS}
      />,
    );

    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
  });
});