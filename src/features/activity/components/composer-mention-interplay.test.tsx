import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MentionCandidateGroups } from "../server/mention-queries";
import { Composer } from "./composer";

const listMentionCandidatesMock = vi.fn<(target: unknown) => Promise<MentionCandidateGroups>>();

vi.mock("../actions", () => ({
  listMentionCandidates: (target: unknown) => listMentionCandidatesMock(target),
}));

const CANDIDATES: MentionCandidateGroups = {
  scoped: [{ id: "member-1", firstName: "Ada", lastName: "Lovelace" }],
  everyoneElse: [],
};

function renderComposer(overrides: Partial<Parameters<typeof Composer>[0]> = {}) {
  const onSubmit = vi.fn();
  const utils = render(
    <Composer
      target={{ projectId: "project-1" }}
      canPost={true}
      postReason={null}
      onSubmit={onSubmit}
      {...overrides}
    />,
  );
  return { onSubmit, ...utils };
}

beforeEach(() => {
  listMentionCandidatesMock.mockReset();
  listMentionCandidatesMock.mockResolvedValue(CANDIDATES);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Composer — the @ mention trigger (FR-024, FR-039)", () => {
  it("opens the mention picker on @ with the full ranked list", async () => {
    renderComposer();
    const field = screen.getByRole("textbox", { name: "Comment" });

    fireEvent.change(field, { target: { value: "Hey @" } });

    await screen.findByRole("option", { name: "Ada Lovelace" });
  });
});

describe("Composer — Escape / cmd-enter interplay with the picker open (FR-063)", () => {
  it("the first Escape closes the picker alone, leaving text and cursor untouched", async () => {
    renderComposer();
    const field = screen.getByRole("textbox", { name: "Comment" }) as HTMLTextAreaElement;

    fireEvent.change(field, { target: { value: "Hey @a" } });
    await screen.findByRole("option", { name: "Ada Lovelace" });

    fireEvent.keyDown(field, { key: "Escape" });

    expect(screen.queryByRole("option", { name: "Ada Lovelace" })).toBeNull();
    expect(field.value).toBe("Hey @a");
  });

  it("a second Escape, once the picker is closed, reverts the field", async () => {
    renderComposer();
    const field = screen.getByRole("textbox", { name: "Comment" }) as HTMLTextAreaElement;

    fireEvent.change(field, { target: { value: "Hey @a" } });
    await screen.findByRole("option", { name: "Ada Lovelace" });

    fireEvent.keyDown(field, { key: "Escape" });
    expect(field.value).toBe("Hey @a");

    fireEvent.keyDown(field, { key: "Escape" });

    expect(field.value).toBe("");
  });

  it("an Escape with the picker never opened reverts the field on its own first press", () => {
    renderComposer();
    const field = screen.getByRole("textbox", { name: "Comment" }) as HTMLTextAreaElement;

    fireEvent.change(field, { target: { value: "Some plain text" } });
    fireEvent.keyDown(field, { key: "Escape" });

    expect(field.value).toBe("");
  });

  it("cmd-enter submits the text exactly as typed, never auto-selecting a suggestion, and closes the picker", async () => {
    const { onSubmit } = renderComposer();
    const field = screen.getByRole("textbox", { name: "Comment" }) as HTMLTextAreaElement;

    fireEvent.change(field, { target: { value: "Hey @a" } });
    await screen.findByRole("option", { name: "Ada Lovelace" });

    fireEvent.keyDown(field, { key: "Enter", metaKey: true });

    expect(onSubmit).toHaveBeenCalledWith("Hey @a");
    expect(screen.queryByRole("option", { name: "Ada Lovelace" })).toBeNull();
  });
});

describe("Composer — posting a selected mention (FR-022, US4 s2)", () => {
  it("submits the raw @[userId] token for a mention picked from the list, not its display name", async () => {
    const { onSubmit } = renderComposer();
    const field = screen.getByRole("textbox", { name: "Comment" }) as HTMLTextAreaElement;

    fireEvent.change(field, { target: { value: "Hey @a" } });
    const option = await screen.findByRole("option", { name: "Ada Lovelace" });
    fireEvent.click(option);

    await waitFor(() => expect(field.value).toBe("Hey Ada Lovelace"));

    fireEvent.keyDown(field, { key: "Enter", metaKey: true });

    expect(onSubmit).toHaveBeenCalledWith("Hey @[member-1]");
  });
});