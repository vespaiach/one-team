import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FeedRow as FeedRowData } from "../server/feed-queries";
import { FeedRow } from "./feed-row";

vi.mock("./comment-row", () => ({
  CommentRow: (props: { body: string }) => <div data-testid="comment-row">{props.body}</div>,
}));

vi.mock("./activity-row", () => ({
  ActivityRow: (props: { type: string }) => <div data-testid="activity-row">{props.type}</div>,
}));

const ACTOR = {
  id: "user-1",
  firstName: "Ada",
  lastName: "Lovelace",
  avatarUrl: null,
  role: "member",
  jobTitle: null,
  deactivatedAt: null,
};

function baseRow(overrides: Partial<FeedRowData> = {}): FeedRowData {
  return {
    id: "row-1",
    kind: "comment",
    actorId: ACTOR.id,
    actor: ACTOR,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    body: "Hello there.",
    canEdit: false,
    canDelete: false,
    field: null,
    fromValue: null,
    toValue: null,
    ...overrides,
  };
}

describe("FeedRow — the kind dispatcher (FR-028)", () => {
  it("dispatches a comment-kind row to CommentRow", () => {
    render(<FeedRow row={baseRow({ kind: "comment" })} />);

    expect(screen.getByTestId("comment-row")).not.toBeNull();
    expect(screen.queryByTestId("activity-row")).toBeNull();
  });

  it.each([
    "created",
    "field_changed",
    "member_added",
    "member_removed",
    "archived",
    "reopened",
  ] as const)("dispatches a %s row to ActivityRow", (kind) => {
    render(<FeedRow row={baseRow({ kind, body: null })} />);

    expect(screen.getByTestId("activity-row")).not.toBeNull();
    expect(screen.queryByTestId("comment-row")).toBeNull();
  });
});