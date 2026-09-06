import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CreateIssueResult } from "@/features/issues/server/create-issue";
import type { Lane } from "../lane-model";
import type { BoardCard } from "../server/board-queries";
import { BoardLane } from "./board-lane";
import { CardComposer, type CardComposerProps } from "./card-composer";

const CREATED: CreateIssueResult = { status: "ok", projectKey: "WEB", number: 12 };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const PROJECT_ID = "0198d2b1-0000-7000-8000-0000000000a1";
const IN_PROGRESS = "0198d2b1-0000-7000-8000-0000000000c1";
const BACKLOG = "0198d2b1-0000-7000-8000-0000000000c2";
const DONE = "0198d2b1-0000-7000-8000-0000000000c3";

const NOT_A_MEMBER = "Only project members can edit issues in Website Redesign.";

function composerProps(overrides: Partial<CardComposerProps> = {}): CardComposerProps {
  return {
    projectId: PROJECT_ID,
    projectKey: "WEB",
    grouping: "column",
    laneId: IN_PROGRESS,
    firstColumnId: IN_PROGRESS,
    canWrite: true,
    writeReason: "",
    laneName: "In Progress",
    laneAcceptsWrite: true,
    onCreate: async () => CREATED,
    ...overrides,
  };
}

function lane(id: string, name: string): Lane<BoardCard> {
  return { id, name, cards: [] };
}

const LANES = [lane(IN_PROGRESS, "In Progress"), lane(BACKLOG, "Backlog"), lane(DONE, "Done")];

function renderBoard(props: Partial<CardComposerProps>) {
  return render(
    <div>
      {LANES.map((each) => (
        <BoardLane
          key={each.id}
          lane={each}
          projectKey="WEB"
          composer={composerProps({ laneName: each.name, ...props })}
        />
      ))}
    </div>,
  );
}

describe("CardComposer — a non-member sees it disabled, never hidden (FR-052, OT-UX-021)", () => {
  it("renders one in every lane", () => {
    renderBoard({ canWrite: false, writeReason: NOT_A_MEMBER });

    expect(screen.getAllByRole("textbox", { name: NOT_A_MEMBER })).toHaveLength(LANES.length);
  });

  it("disables each one and carries the reason in place of Add a card, naming the project", () => {
    renderBoard({ canWrite: false, writeReason: NOT_A_MEMBER });

    expect(screen.queryByRole("textbox", { name: "Add a card" })).toBeNull();
    for (const field of screen.getAllByRole("textbox", { name: NOT_A_MEMBER })) {
      expect(field).toHaveProperty("disabled", true);
      expect(field.getAttribute("placeholder")).toBe(NOT_A_MEMBER);
    }
  });

  it("creates nothing when enter is pressed on it", () => {
    const onCreate = vi.fn(async () => CREATED);
    render(<CardComposer {...composerProps({ canWrite: false, writeReason: NOT_A_MEMBER, onCreate })} />);

    const field = screen.getByRole("textbox", { name: NOT_A_MEMBER });
    fireEvent.change(field, { target: { value: "Trim the seed data" } });
    fireEvent.keyDown(field, { key: "Enter" });

    expect(onCreate).not.toHaveBeenCalled();
  });
});

describe("CardComposer — a member, a lane outside the assignee pool (FR-037, FR-052)", () => {
  const OUTSIDE_POOL = "Casey Jordan isn't in this project's assignee pool, so a card can't be added here.";

  it("renders it disabled with the reason inline rather than hiding it", () => {
    render(
      <BoardLane
        lane={{ ...lane("0198d2b1-0000-7000-8000-0000000000d9", "Casey Jordan"), canAcceptDrop: false }}
        projectKey="WEB"
        composer={composerProps({ laneName: "Casey Jordan", laneAcceptsWrite: false })}
      />,
    );

    const field = screen.getByRole("textbox", { name: OUTSIDE_POOL });
    expect(field).toHaveProperty("disabled", true);
    expect(field.getAttribute("placeholder")).toBe(OUTSIDE_POOL);
  });

  it("leaves every other lane's composer enabled and named Add a card", () => {
    renderBoard({});

    expect(screen.getAllByRole("textbox", { name: "Add a card" })).toHaveLength(LANES.length);
    for (const field of screen.getAllByRole("textbox", { name: "Add a card" })) {
      expect(field).toHaveProperty("disabled", false);
    }
  });
});