import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CreateIssueResult } from "@/features/issues/server/create-issue";
import type { Lane } from "../lane-model";
import type { BoardCard } from "../server/board-queries";
import { BoardLane } from "./board-lane";
import { CardComposer, type CardComposerPayload, type CardComposerProps } from "./card-composer";

const CREATED: CreateIssueResult = { status: "ok", projectKey: "WEB", number: 12 };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const PROJECT_ID = "0198d2b1-0000-7000-8000-0000000000a1";
const IN_PROGRESS = "0198d2b1-0000-7000-8000-0000000000c1";

function card(number: number, title: string, order: number): BoardCard {
  return {
    id: `0198d2b1-0000-7000-8000-00000000${String(number).padStart(4, "0")}`,
    key: `WEB-${number}`,
    title,
    columnId: IN_PROGRESS,
    assigneeId: null,
    priority: "none",
    dueDate: null,
    labels: [],
    assignee: null,
    commentCount: 0,
    order,
  };
}

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

function lane(cards: BoardCard[]): Lane<BoardCard> {
  return { id: IN_PROGRESS, name: "In Progress", cards };
}

function fieldNamed(name: string): HTMLElement {
  return screen.getByRole("textbox", { name });
}

function describedText(field: HTMLElement): string {
  return (field.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");
}

describe("CardComposer — one at the foot of every lane (FR-046)", () => {
  it("sits below the cards of a lane that holds them", () => {
    render(
      <BoardLane
        lane={lane([card(7, "Rework the sign-in copy", 0)])}
        projectKey="WEB"
        composer={composerProps()}
      />,
    );

    const grid = screen.getByRole("grid", { name: "In Progress" });
    const field = fieldNamed("Add a card");

    expect(grid.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("sits below an empty lane's one quiet line, which still shows (FR-008)", () => {
    render(
      <BoardLane
        lane={lane([])}
        projectKey="WEB"
        composer={composerProps()}
      />,
    );

    const quietLine = screen.getByText("No cards");
    const field = fieldNamed("Add a card");

    expect(quietLine.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("takes a title and nothing else", () => {
    render(<CardComposer {...composerProps()} />);

    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.queryByRole("spinbutton")).toBeNull();
  });
});

describe("CardComposer — enter creates one card (FR-046, FR-047)", () => {
  it("hands the trimmed title to the create call", async () => {
    const onCreate = vi.fn<(payload: CardComposerPayload) => Promise<CreateIssueResult>>(async () => CREATED);
    render(<CardComposer {...composerProps({ onCreate })} />);

    const field = fieldNamed("Add a card");
    fireEvent.change(field, { target: { value: "  Trim the seed data  " } });
    fireEvent.keyDown(field, { key: "Enter" });

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    expect(onCreate.mock.calls[0]?.[0]).toMatchObject({ title: "Trim the seed data" });
  });
});

describe("CardComposer — an empty title is refused on the field (FR-051)", () => {
  it("creates nothing and names the refusal inline, not as a toast", async () => {
    const onCreate = vi.fn(async () => CREATED);
    render(<CardComposer {...composerProps({ onCreate })} />);

    const field = fieldNamed("Add a card");
    fireEvent.change(field, { target: { value: "   " } });
    fireEvent.keyDown(field, { key: "Enter" });

    await waitFor(() => expect(describedText(field)).toContain("Title is required."));
    expect(onCreate).not.toHaveBeenCalled();
  });
});

describe("CardComposer — a server refusal comes back to the field (FR-051, FR-052, FR-065, FR-066)", () => {
  const LONG_TITLE = "T".repeat(201);

  it("keeps the typed title and names a too-long refusal inline on the field", async () => {
    const onCreate = vi.fn(async () => ({ status: "invalid", field: "title", reason: "too-long" }) as const);
    render(<CardComposer {...composerProps({ onCreate })} />);

    const field = fieldNamed("Add a card");
    fireEvent.change(field, { target: { value: LONG_TITLE } });
    fireEvent.keyDown(field, { key: "Enter" });

    await waitFor(() =>
      expect(describedText(fieldNamed("Add a card"))).toContain("Title must be 200 characters or fewer."),
    );
    expect(fieldNamed("Add a card")).toHaveProperty("value", LONG_TITLE);
  });

  it("surfaces a forbidden refusal's own reason and keeps the typed title", async () => {
    const reason = "You're not a member of Website Redesign.";
    const onCreate = vi.fn(async () => ({ status: "forbidden", reason }) as const);
    render(<CardComposer {...composerProps({ onCreate })} />);

    const field = fieldNamed("Add a card");
    fireEvent.change(field, { target: { value: "Trim the seed data" } });
    fireEvent.keyDown(field, { key: "Enter" });

    await waitFor(() => expect(describedText(fieldNamed("Add a card"))).toContain(reason));
    expect(fieldNamed("Add a card")).toHaveProperty("value", "Trim the seed data");
  });

  it("never clears the field on a refusal it has no field wording for", async () => {
    const onCreate = vi.fn(async () => ({ status: "not-found" }) as const);
    render(<CardComposer {...composerProps({ onCreate })} />);

    const field = fieldNamed("Add a card");
    fireEvent.change(field, { target: { value: "Trim the seed data" } });
    fireEvent.keyDown(field, { key: "Enter" });

    await waitFor(() =>
      expect(describedText(fieldNamed("Add a card"))).toContain("That card wasn't created."),
    );
    expect(fieldNamed("Add a card")).toHaveProperty("value", "Trim the seed data");
  });
});

describe("CardComposer — the create waits for the server (FR-050, OT-UX-008)", () => {
  it("shows in-flight state and adds no card while the call is out", async () => {
    let answer: () => void = () => {};
    const onCreate = vi.fn(
      () =>
        new Promise<CreateIssueResult>((resolve) => {
          answer = () => resolve(CREATED);
        }),
    );
    render(
      <BoardLane
        lane={lane([card(7, "Rework the sign-in copy", 0)])}
        projectKey="WEB"
        composer={composerProps({ onCreate })}
      />,
    );

    const field = fieldNamed("Add a card");
    fireEvent.change(field, { target: { value: "Trim the seed data" } });
    fireEvent.keyDown(field, { key: "Enter" });

    await waitFor(() => expect(screen.getByText("Adding…")).not.toBeNull());
    expect(screen.getAllByRole("row")).toHaveLength(1);
    expect(fieldNamed("Add a card")).toHaveProperty("disabled", true);

    answer();
    await waitFor(() => expect(screen.queryByText("Adding…")).toBeNull());
  });

  it("clears the field and stays ready once the server answers", async () => {
    const onCreate = vi.fn(async () => CREATED);
    render(<CardComposer {...composerProps({ onCreate })} />);

    const field = fieldNamed("Add a card");
    fireEvent.change(field, { target: { value: "Trim the seed data" } });
    fireEvent.keyDown(field, { key: "Enter" });

    await waitFor(() => expect(fieldNamed("Add a card")).toHaveProperty("value", ""));
    expect(fieldNamed("Add a card")).toHaveProperty("disabled", false);
  });
});