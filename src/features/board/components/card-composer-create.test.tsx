import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CreateIssueResult } from "@/features/issues/server/create-issue";
import { CardComposer, type CardComposerPayload, type CardComposerProps } from "./card-composer";

const CREATED: CreateIssueResult = { status: "ok", projectKey: "WEB", number: 12 };

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

const PROJECT_ID = "0198d2b1-0000-7000-8000-0000000000a1";
const FIRST_COLUMN = "0198d2b1-0000-7000-8000-0000000000c1";
const IN_PROGRESS = "0198d2b1-0000-7000-8000-0000000000c2";
const CASEY = "0198d2b1-0000-7000-8000-0000000000d1";
const TITLE = "Trim the seed data";

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

function describedText(field: HTMLElement): string {
  return (field.getAttribute("aria-describedby") ?? "")
    .split(" ")
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ");
}

async function submitTitle(overrides: Partial<CardComposerProps>): Promise<CardComposerPayload> {
  const onCreate = vi.fn<(payload: CardComposerPayload) => Promise<CreateIssueResult>>(async () => CREATED);
  render(<CardComposer {...composerProps({ ...overrides, onCreate })} />);

  const field = screen.getByRole("textbox", { name: "Add a card" });
  fireEvent.change(field, { target: { value: TITLE } });
  fireEvent.keyDown(field, { key: "Enter" });

  await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
  const [payload] = onCreate.mock.calls[0] ?? [];
  if (payload === undefined) {
    throw new Error("the composer made no create call");
  }
  return payload;
}

describe("CardComposer — the payload each grouping writes (FR-047, contracts/mutators.md)", () => {
  it("creates in that lane's column under Column grouping, and sets nothing else", async () => {
    const payload = await submitTitle({ grouping: "column", laneId: IN_PROGRESS });

    expect(payload).toStrictEqual({
      projectId: PROJECT_ID,
      title: TITLE,
      columnId: IN_PROGRESS,
    });
  });

  it("creates in the first column carrying the lane's assignee under Assignee grouping", async () => {
    const payload = await submitTitle({ grouping: "assignee", laneId: CASEY, laneName: "Casey Jordan" });

    expect(payload).toStrictEqual({
      projectId: PROJECT_ID,
      title: TITLE,
      columnId: FIRST_COLUMN,
      assigneeId: CASEY,
    });
  });

  it("carries no assignee for the Unassigned lane", async () => {
    const payload = await submitTitle({ grouping: "assignee", laneId: null, laneName: "Unassigned" });

    expect(payload).toStrictEqual({
      projectId: PROJECT_ID,
      title: TITLE,
      columnId: FIRST_COLUMN,
    });
  });

  it("creates in the first column carrying the lane's priority under Priority grouping", async () => {
    const payload = await submitTitle({ grouping: "priority", laneId: "high", laneName: "High" });

    expect(payload).toStrictEqual({
      projectId: PROJECT_ID,
      title: TITLE,
      columnId: FIRST_COLUMN,
      priority: "high",
    });
  });
});
describe("CardComposer — a create the connection loses (FR-050, FR-065)", () => {
  it("keeps the typed title and says on the field that nothing was created", async () => {
    const onCreate = vi.fn(async () => {
      throw new Error("connection lost");
    });
    render(<CardComposer {...composerProps({ onCreate })} />);

    const field = screen.getByRole("textbox", { name: "Add a card" });
    fireEvent.change(field, { target: { value: TITLE } });
    fireEvent.keyDown(field, { key: "Enter" });

    await waitFor(() => expect(onCreate).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(describedText(screen.getByRole("textbox", { name: "Add a card" }))).toContain(
        "That card wasn't created — the connection was lost.",
      ),
    );
    expect(screen.getByRole("textbox", { name: "Add a card" })).toHaveProperty("value", TITLE);
  });
});