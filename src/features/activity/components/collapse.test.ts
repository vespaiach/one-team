import { describe, expect, it } from "vitest";
import type { FeedRow } from "../server/feed-queries";
import { collapseFeed } from "./collapse";

const ACTOR = {
  id: "user-1",
  firstName: "Ana",
  lastName: "Ng",
  avatarUrl: null,
  role: "member",
  jobTitle: null,
  deactivatedAt: null,
};

const OTHER_ACTOR = { ...ACTOR, id: "user-2", firstName: "Bea" };

const BASE_TIME = new Date("2026-01-01T00:00:00.000Z").getTime();

function activityRow(overrides: Partial<FeedRow> = {}): FeedRow {
  return {
    id: `activity-${crypto.randomUUID()}`,
    kind: "field_changed",
    actorId: ACTOR.id,
    actor: ACTOR,
    createdAt: new Date(BASE_TIME),
    body: null,
    canEdit: null,
    canDelete: null,
    field: "status",
    fromValue: "Open",
    toValue: "Closed",
    ...overrides,
  };
}

function commentRow(overrides: Partial<FeedRow> = {}): FeedRow {
  return {
    id: `comment-${crypto.randomUUID()}`,
    kind: "comment",
    actorId: ACTOR.id,
    actor: ACTOR,
    createdAt: new Date(BASE_TIME),
    body: "A message someone wrote.",
    canEdit: true,
    canDelete: true,
    field: null,
    fromValue: null,
    toValue: null,
    ...overrides,
  };
}

function minutesAfterBase(minutes: number): Date {
  return new Date(BASE_TIME + minutes * 60_000);
}

describe("collapseFeed (FR-031, research F-2)", () => {
  it("collapses consecutive non-comment rows by the same actor within five minutes into one group", () => {
    const rows = [
      activityRow({ id: "c", createdAt: minutesAfterBase(4) }),
      activityRow({ id: "b", createdAt: minutesAfterBase(2) }),
      activityRow({ id: "a", createdAt: minutesAfterBase(0) }),
    ];

    const groups = collapseFeed(rows);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.map((row) => row.id)).toEqual(["c", "b", "a"]);
  });

  it("treats a gap of exactly five minutes as still within the run (inclusive)", () => {
    const rows = [
      activityRow({ id: "b", createdAt: minutesAfterBase(5) }),
      activityRow({ id: "a", createdAt: minutesAfterBase(0) }),
    ];

    const groups = collapseFeed(rows);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.map((row) => row.id)).toEqual(["b", "a"]);
  });

  it("starts a new run once a gap exceeds five minutes since the immediately preceding row", () => {
    const rows = [
      activityRow({ id: "b", createdAt: minutesAfterBase(5.01) }),
      activityRow({ id: "a", createdAt: minutesAfterBase(0) }),
    ];

    const groups = collapseFeed(rows);

    expect(groups).toHaveLength(2);
    expect(groups.map((group) => group.map((row) => row.id))).toEqual([["b"], ["a"]]);
  });

  it("chains a steady drip spaced under five minutes apart into one run, even though the span from first to last exceeds five minutes", () => {
    const rows = [
      activityRow({ id: "d", createdAt: minutesAfterBase(12) }),
      activityRow({ id: "c", createdAt: minutesAfterBase(8) }),
      activityRow({ id: "b", createdAt: minutesAfterBase(4) }),
      activityRow({ id: "a", createdAt: minutesAfterBase(0) }),
    ];

    const groups = collapseFeed(rows);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.map((row) => row.id)).toEqual(["d", "c", "b", "a"]);
  });

  it("does not extend a run when a later row's gap from the run's most recent member exceeds five minutes, even though the first member is still close to the run's start", () => {
    const rows = [
      activityRow({ id: "c", createdAt: minutesAfterBase(9) }),
      activityRow({ id: "b", createdAt: minutesAfterBase(3) }),
      activityRow({ id: "a", createdAt: minutesAfterBase(0) }),
    ];

    const groups = collapseFeed(rows);

    expect(groups.map((group) => group.map((row) => row.id))).toEqual([["c"], ["b", "a"]]);
  });

  it("ends a run when the same actor's next row is a different actor", () => {
    const rows = [
      activityRow({ id: "b", actorId: OTHER_ACTOR.id, actor: OTHER_ACTOR, createdAt: minutesAfterBase(1) }),
      activityRow({ id: "a", createdAt: minutesAfterBase(0) }),
    ];

    const groups = collapseFeed(rows);

    expect(groups.map((group) => group.map((row) => row.id))).toEqual([["b"], ["a"]]);
  });

  it("never collapses a comment row with any neighbour, whatever the timing", () => {
    const rows = [
      commentRow({ id: "comment", createdAt: minutesAfterBase(2) }),
      activityRow({ id: "activity", createdAt: minutesAfterBase(0) }),
    ];

    const groups = collapseFeed(rows);

    expect(groups.map((group) => group.map((row) => row.id))).toEqual([["comment"], ["activity"]]);
  });

  it("always ends the run preceding a comment row without the comment joining it", () => {
    const rows = [
      activityRow({ id: "after", createdAt: minutesAfterBase(3) }),
      commentRow({ id: "comment", createdAt: minutesAfterBase(2) }),
      activityRow({ id: "before", createdAt: minutesAfterBase(0) }),
    ];

    const groups = collapseFeed(rows);

    expect(groups.map((group) => group.map((row) => row.id))).toEqual([["after"], ["comment"], ["before"]]);
  });

  it("re-merges a run left open at the first page's foot with its continuation once the next page is appended", () => {
    const firstPage = [
      activityRow({ id: "page1-newest", createdAt: minutesAfterBase(8) }),
      activityRow({ id: "page1-foot", createdAt: minutesAfterBase(4) }),
    ];
    const secondPage = [
      activityRow({ id: "page2-head", createdAt: minutesAfterBase(1) }),
      activityRow({ id: "page2-oldest", createdAt: minutesAfterBase(0) }),
    ];

    const firstPageGroups = collapseFeed(firstPage);
    expect(firstPageGroups).toHaveLength(1);
    expect(firstPageGroups[0]).toHaveLength(2);

    const combinedGroups = collapseFeed([...firstPage, ...secondPage]);

    expect(combinedGroups).toHaveLength(1);
    expect(combinedGroups[0]?.map((row) => row.id)).toEqual([
      "page1-newest",
      "page1-foot",
      "page2-head",
      "page2-oldest",
    ]);
  });

  it("does not merge across a page boundary once the gap since the foot's own timestamp exceeds five minutes", () => {
    const firstPage = [activityRow({ id: "page1-foot", createdAt: minutesAfterBase(10) })];
    const secondPage = [activityRow({ id: "page2-head", createdAt: minutesAfterBase(0) })];

    const combinedGroups = collapseFeed([...firstPage, ...secondPage]);

    expect(combinedGroups.map((group) => group.map((row) => row.id))).toEqual([
      ["page1-foot"],
      ["page2-head"],
    ]);
  });
});