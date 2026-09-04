import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedRow } from "../server/feed-queries";
import { FeedFilterToggle, filterFeedRows } from "./feed-filter-toggle";

const setFeedFilterMock = vi.fn();
vi.mock("../actions", () => ({
  setFeedFilter: (...args: unknown[]) => setFeedFilterMock(...args),
}));

const ACTOR = {
  id: "user-1",
  firstName: "Ana",
  lastName: "Ng",
  avatarUrl: null,
  role: "member",
  jobTitle: null,
  deactivatedAt: null,
};

function commentRow(overrides: Partial<FeedRow> = {}): FeedRow {
  return {
    id: `comment-${crypto.randomUUID()}`,
    kind: "comment",
    actorId: ACTOR.id,
    actor: ACTOR,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    body: "A message.",
    canEdit: true,
    canDelete: true,
    field: null,
    fromValue: null,
    toValue: null,
    ...overrides,
  };
}

function activityRow(overrides: Partial<FeedRow> = {}): FeedRow {
  return {
    id: `activity-${crypto.randomUUID()}`,
    kind: "field_changed",
    actorId: ACTOR.id,
    actor: ACTOR,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    body: null,
    canEdit: null,
    canDelete: null,
    field: "status",
    fromValue: "Open",
    toValue: "Closed",
    ...overrides,
  };
}

beforeEach(() => {
  setFeedFilterMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("FeedFilterToggle — initial state (SC-009, US5 s3)", () => {
  it("reflects the feedFilter prop on the very first render, with no flash of the other state", () => {
    render(
      <FeedFilterToggle
        value="comments"
        onChange={() => undefined}
      />,
    );

    expect(screen.getByRole("radio", { name: "Comments only" })).toHaveProperty("checked", true);
    expect(screen.getByRole("radio", { name: "All activity" })).toHaveProperty("checked", false);
  });

  it("has no tablist role — it is a two-state toggle, not tabs", () => {
    render(
      <FeedFilterToggle
        value="all"
        onChange={() => undefined}
      />,
    );

    expect(screen.queryByRole("tablist")).toBeNull();
  });
});

describe("FeedFilterToggle — calls setFeedFilter on change (FR-033, FR-034)", () => {
  it("calls setFeedFilter and the onChange callback when the selection changes", () => {
    const onChange = vi.fn();
    render(
      <FeedFilterToggle
        value="all"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "Comments only" }));

    expect(onChange).toHaveBeenCalledWith("comments");
    expect(setFeedFilterMock).toHaveBeenCalledWith({ filter: "comments" });
  });

  it("issues no re-fetch of feed rows — setFeedFilter is the only call it makes", () => {
    const onChange = vi.fn();
    render(
      <FeedFilterToggle
        value="comments"
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: "All activity" }));

    expect(setFeedFilterMock).toHaveBeenCalledTimes(1);
  });
});

describe("filterFeedRows — client-side filtering of already-loaded rows (FR-033, US5 s5)", () => {
  it("Comments only hides every non-comment row", () => {
    const rows = [commentRow({ id: "c1" }), activityRow({ id: "a1" }), commentRow({ id: "c2" })];

    const filtered = filterFeedRows(rows, "comments");

    expect(filtered.map((row) => row.id)).toEqual(["c1", "c2"]);
  });

  it("All activity shows every row, unfiltered", () => {
    const rows = [commentRow({ id: "c1" }), activityRow({ id: "a1" })];

    const filtered = filterFeedRows(rows, "all");

    expect(filtered.map((row) => row.id)).toEqual(["c1", "a1"]);
  });
});