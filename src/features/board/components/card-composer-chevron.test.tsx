import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CreateIssueResult } from "@/features/issues/server/create-issue";
import { CardComposer, type CardComposerProps } from "./card-composer";

const CREATED: CreateIssueResult = { status: "ok", projectKey: "WEB", number: 12 };

const { pushMock } = vi.hoisted(() => ({ pushMock: vi.fn() }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), refresh: vi.fn() }),
}));

const PROJECT_ID = "0198d2b1-0000-7000-8000-0000000000a1";
const FIRST_COLUMN = "0198d2b1-0000-7000-8000-0000000000c1";
const IN_PROGRESS = "0198d2b1-0000-7000-8000-0000000000c2";
const CASEY = "0198d2b1-0000-7000-8000-0000000000d1";

const NEW_ISSUE_PATH = "/projects/WEB/issues/new";
const OPEN_THE_FULL_FORM = "Open the full form";
const TITLE = "Trim the seed data";
const TYPED_TITLE = "title=Trim+the+seed+data";

const NOT_A_MEMBER = "Only project members can edit issues in Website Redesign.";
const OUTSIDE_POOL = "Casey Jordan isn't in this project's assignee pool, so a card can't be added here.";

function composerProps(overrides: Partial<CardComposerProps> = {}): CardComposerProps {
  return {
    projectId: PROJECT_ID,
    projectKey: "WEB",
    grouping: "column",
    laneId: IN_PROGRESS,
    laneName: "In Progress",
    firstColumnId: FIRST_COLUMN,
    canWrite: true,
    writeReason: "",
    laneAcceptsWrite: true,
    onCreate: async () => CREATED,
    ...overrides,
  };
}

function renderComposer(overrides: Partial<CardComposerProps> = {}) {
  pushMock.mockClear();
  render(<CardComposer {...composerProps(overrides)} />);
}

function typeTitle(name: string) {
  fireEvent.change(screen.getByRole("textbox", { name }), { target: { value: TITLE } });
}

describe("CardComposer chevron — the preselection it carries (FR-048, US4 sc.4)", () => {
  it("has its own accessible name and is rendered beside the composer", () => {
    renderComposer();

    expect(screen.getByRole("button", { name: OPEN_THE_FULL_FORM })).toHaveProperty("disabled", false);
  });

  it("opens the Create issue page with this lane's column under Column grouping", () => {
    renderComposer({ grouping: "column", laneId: IN_PROGRESS });
    typeTitle("Add a card");

    fireEvent.click(screen.getByRole("button", { name: OPEN_THE_FULL_FORM }));

    expect(pushMock).toHaveBeenCalledWith(`${NEW_ISSUE_PATH}?${TYPED_TITLE}&columnId=${IN_PROGRESS}`);
  });

  it("carries the first column and the lane's assignee under Assignee grouping", () => {
    renderComposer({ grouping: "assignee", laneId: CASEY, laneName: "Casey Jordan" });
    typeTitle("Add a card");

    fireEvent.click(screen.getByRole("button", { name: OPEN_THE_FULL_FORM }));

    expect(pushMock).toHaveBeenCalledWith(
      `${NEW_ISSUE_PATH}?${TYPED_TITLE}&columnId=${FIRST_COLUMN}&assigneeId=${CASEY}`,
    );
  });

  it("carries the first column and the lane's priority under Priority grouping", () => {
    renderComposer({ grouping: "priority", laneId: "high", laneName: "High" });
    typeTitle("Add a card");

    fireEvent.click(screen.getByRole("button", { name: OPEN_THE_FULL_FORM }));

    expect(pushMock).toHaveBeenCalledWith(
      `${NEW_ISSUE_PATH}?${TYPED_TITLE}&columnId=${FIRST_COLUMN}&priority=high`,
    );
  });

  it("carries no title parameter when nothing has been typed", () => {
    renderComposer({ grouping: "assignee", laneId: null, laneName: "Unassigned" });

    fireEvent.click(screen.getByRole("button", { name: OPEN_THE_FULL_FORM }));

    expect(pushMock).toHaveBeenCalledWith(`${NEW_ISSUE_PATH}?columnId=${FIRST_COLUMN}`);
  });
});

describe("CardComposer — shift-enter opens the same page (FR-048, US4 sc.4)", () => {
  it("opens it with exactly what the chevron would have carried", () => {
    renderComposer({ grouping: "priority", laneId: "high", laneName: "High" });
    typeTitle("Add a card");

    fireEvent.keyDown(screen.getByRole("textbox", { name: "Add a card" }), {
      key: "Enter",
      shiftKey: true,
    });

    expect(pushMock).toHaveBeenCalledWith(
      `${NEW_ISSUE_PATH}?${TYPED_TITLE}&columnId=${FIRST_COLUMN}&priority=high`,
    );
  });

  it("leaves plain enter creating in place, navigating nowhere", async () => {
    const onCreate = vi.fn(async () => CREATED);
    renderComposer({ onCreate });
    typeTitle("Add a card");

    expect(screen.getByRole("button", { name: OPEN_THE_FULL_FORM })).toHaveProperty("disabled", false);
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Add a card" }), { key: "Enter" });

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(pushMock).not.toHaveBeenCalled();
  });
});

describe("CardComposer chevron — disabled with the reason, never hidden (FR-052, Clarifications 2026-09-05)", () => {
  it("renders it disabled for a non-member, carrying the composer's reason", () => {
    renderComposer({ canWrite: false, writeReason: NOT_A_MEMBER });

    const chevron = screen.getByRole("button", { name: NOT_A_MEMBER });
    expect(chevron).toHaveProperty("disabled", true);
    expect(screen.queryByRole("button", { name: OPEN_THE_FULL_FORM })).toBeNull();
  });

  it("renders it disabled for a member in a lane outside the assignee pool", () => {
    renderComposer({
      grouping: "assignee",
      laneId: CASEY,
      laneName: "Casey Jordan",
      laneAcceptsWrite: false,
    });

    const chevron = screen.getByRole("button", { name: OUTSIDE_POOL });
    expect(chevron).toHaveProperty("disabled", true);
  });

  it("emits no assigneeId from a lane outside the assignee pool, by chevron or shift-enter", () => {
    renderComposer({
      grouping: "assignee",
      laneId: CASEY,
      laneName: "Casey Jordan",
      laneAcceptsWrite: false,
    });

    fireEvent.click(screen.getByRole("button", { name: OUTSIDE_POOL }));
    fireEvent.keyDown(screen.getByRole("textbox", { name: OUTSIDE_POOL }), {
      key: "Enter",
      shiftKey: true,
    });

    expect(pushMock).not.toHaveBeenCalled();
  });
});