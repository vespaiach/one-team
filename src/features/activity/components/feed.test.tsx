import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateCommentResult } from "../actions";
import type { FeedPage, FeedRow } from "../server/feed-queries";
import { Feed } from "./feed";

const showToastMock = vi.fn();
vi.mock("@/features/shell/components/toast-region", () => ({
  showToast: (...args: unknown[]) => showToastMock(...args),
}));

const createCommentMock = vi.fn<(input: { target: unknown; body: string }) => Promise<CreateCommentResult>>();
vi.mock("../actions", () => ({
  createComment: (...args: [{ target: unknown; body: string }]) => createCommentMock(...args),
}));

const VIEWER = { id: "user-1", firstName: "Ada", lastName: "Lovelace", avatarUrl: null };

const ACTOR = {
  id: "user-2",
  firstName: "Alan",
  lastName: "Turing",
  avatarUrl: null,
  role: "member",
  jobTitle: null,
  deactivatedAt: null,
};

function existingRow(overrides: Partial<FeedRow> = {}): FeedRow {
  return {
    id: "comment-existing",
    kind: "comment",
    actorId: ACTOR.id,
    actor: ACTOR,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    body: "Existing comment.",
    canEdit: false,
    canDelete: false,
    field: null,
    fromValue: null,
    toValue: null,
    ...overrides,
  };
}

function renderFeed(initialPage: FeedPage) {
  return render(
    <Feed
      target={{ projectId: "project-1" }}
      initialPage={initialPage}
      canPost={true}
      postReason={null}
      viewer={VIEWER}
    />,
  );
}

beforeEach(() => {
  createCommentMock.mockReset();
  showToastMock.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Feed — rendering (FR-027)", () => {
  it("renders the Composer fixed at the head and the initial page's rows, no tabs", () => {
    renderFeed({ rows: [existingRow()], hasNextPage: false });

    expect(screen.getByRole("textbox", { name: "Comment" })).not.toBeNull();
    expect(screen.getByText("Existing comment.")).not.toBeNull();
    expect(screen.queryByRole("tablist")).toBeNull();
  });
});

describe("Feed — optimistic posting (FR-037, US1 s1)", () => {
  it("renders the new row before the action resolves", async () => {
    let resolveCreate: (value: CreateCommentResult) => void = () => undefined;
    createCommentMock.mockImplementation(
      () =>
        new Promise<CreateCommentResult>((resolve) => {
          resolveCreate = resolve;
        }),
    );
    renderFeed({ rows: [], hasNextPage: false });

    const field = screen.getByRole("textbox", { name: "Comment" });
    fireEvent.change(field, { target: { value: "Posting now." } });
    fireEvent.keyDown(field, { key: "Enter", metaKey: true });

    await waitFor(() => expect(screen.getByText("Posting now.")).not.toBeNull());

    resolveCreate({
      status: "ok",
      comment: existingRow({ id: "comment-new", body: "Posting now.", canEdit: true, canDelete: true }),
    });
  });

  it("rolls back the optimistic row and raises a toast naming the server's own returned message on refusal", async () => {
    createCommentMock.mockResolvedValue({
      status: "forbidden",
      reason: "Only project members can comment here.",
    });
    renderFeed({ rows: [], hasNextPage: false });

    const field = screen.getByRole("textbox", { name: "Comment" });
    fireEvent.change(field, { target: { value: "Posting now." } });
    fireEvent.keyDown(field, { key: "Enter", metaKey: true });

    await waitFor(() => expect(showToastMock).toHaveBeenCalledTimes(1));
    expect(showToastMock).toHaveBeenCalledWith({
      kind: "error",
      message: "Only project members can comment here.",
    });
    await waitFor(() => expect(screen.queryByText("Posting now.")).toBeNull());
  });

  it("raises no toast on a successful post", async () => {
    createCommentMock.mockResolvedValue({
      status: "ok",
      comment: existingRow({ id: "comment-new", body: "Posting now." }),
    });
    renderFeed({ rows: [], hasNextPage: false });

    const field = screen.getByRole("textbox", { name: "Comment" });
    fireEvent.change(field, { target: { value: "Posting now." } });
    fireEvent.keyDown(field, { key: "Enter", metaKey: true });

    await waitFor(() => expect(createCommentMock).toHaveBeenCalledTimes(1));
    expect(showToastMock).not.toHaveBeenCalled();
  });
});