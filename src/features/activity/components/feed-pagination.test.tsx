import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedPage, FeedRow } from "../server/feed-queries";
import { Feed } from "./feed";

const showToastMock = vi.fn();
vi.mock("@/features/shell/components/toast-region", () => ({
  showToast: (...args: unknown[]) => showToastMock(...args),
}));

const createCommentMock = vi.fn();
const loadFeedPageMock = vi.fn();
vi.mock("../actions", () => ({
  createComment: (...args: unknown[]) => createCommentMock(...args),
  setFeedFilter: vi.fn(),
  loadFeedPage: (...args: unknown[]) => loadFeedPageMock(...args),
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

function commentRow(overrides: Partial<FeedRow> = {}): FeedRow {
  return {
    id: "comment-1",
    kind: "comment",
    actorId: ACTOR.id,
    actor: ACTOR,
    createdAt: new Date("2026-01-01T00:10:00.000Z"),
    body: "Oldest loaded row.",
    canEdit: false,
    canDelete: false,
    field: null,
    fromValue: null,
    toValue: null,
    ...overrides,
  };
}

function activityRow(overrides: Partial<FeedRow> = {}): FeedRow {
  return {
    id: "activity-1",
    kind: "field_changed",
    actorId: ACTOR.id,
    actor: ACTOR,
    createdAt: new Date("2026-01-01T00:20:00.000Z"),
    body: null,
    canEdit: null,
    canDelete: null,
    field: "status",
    fromValue: "Open",
    toValue: "Closed",
    ...overrides,
  };
}

class FakeIntersectionObserver {
  static instances: FakeIntersectionObserver[] = [];
  callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    FakeIntersectionObserver.instances.push(this);
  }

  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }

  trigger() {
    this.callback(
      [{ isIntersecting: true } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

function latestObserver(): FakeIntersectionObserver {
  const observer = FakeIntersectionObserver.instances.at(-1);
  if (!observer) {
    throw new Error("no IntersectionObserver was constructed");
  }
  return observer;
}

function renderFeed(initialPage: FeedPage) {
  return render(
    <Feed
      target={{ projectId: "project-1" }}
      initialPage={initialPage}
      canPost={true}
      postReason={null}
      viewer={VIEWER}
      feedFilter="all"
    />,
  );
}

beforeEach(() => {
  createCommentMock.mockReset();
  loadFeedPageMock.mockReset();
  showToastMock.mockClear();
  FakeIntersectionObserver.instances = [];
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Feed — pagination on scroll to the foot (FR-032, research F-1)", () => {
  it("calls listFeed (via loadFeedPage) with the last loaded row's own (createdAt, id) cursor and appends the result", async () => {
    const initialPage: FeedPage = {
      rows: [activityRow(), commentRow()],
      hasNextPage: true,
    };
    loadFeedPageMock.mockResolvedValue({
      rows: [
        commentRow({
          id: "comment-appended",
          body: "Appended row.",
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        }),
      ],
      hasNextPage: false,
    });

    renderFeed(initialPage);

    latestObserver().trigger();

    await waitFor(() => expect(loadFeedPageMock).toHaveBeenCalledTimes(1));
    expect(loadFeedPageMock).toHaveBeenCalledWith({
      target: { projectId: "project-1" },
      cursor: { createdAt: "2026-01-01T00:10:00.000Z", id: "comment-1" },
    });

    await waitFor(() => expect(screen.getByText("Appended row.")).not.toBeNull());
  });

  it("appends without a full reload — the rows already on screen stay put", async () => {
    const initialPage: FeedPage = {
      rows: [commentRow({ id: "comment-1", body: "Original row." })],
      hasNextPage: true,
    };
    loadFeedPageMock.mockResolvedValue({
      rows: [commentRow({ id: "comment-appended", body: "Appended row." })],
      hasNextPage: false,
    });

    renderFeed(initialPage);
    latestObserver().trigger();

    await waitFor(() => expect(screen.getByText("Appended row.")).not.toBeNull());
    expect(screen.getByText("Original row.")).not.toBeNull();
  });

  it("removes the load-more sentinel once the appended page reports no next page", async () => {
    const initialPage: FeedPage = {
      rows: [commentRow({ id: "comment-1" })],
      hasNextPage: true,
    };
    loadFeedPageMock.mockResolvedValue({ rows: [], hasNextPage: false });

    renderFeed(initialPage);
    expect(screen.getByTestId("feed-load-more-sentinel")).not.toBeNull();

    latestObserver().trigger();

    await waitFor(() => expect(loadFeedPageMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByTestId("feed-load-more-sentinel")).toBeNull());
  });

  it("the raw-row page count is independent of how many rows the appended burst collapses into", async () => {
    const initialPage: FeedPage = {
      rows: [commentRow({ id: "comment-1", createdAt: new Date("2026-01-01T00:00:00.000Z") })],
      hasNextPage: true,
    };
    const burst = [
      activityRow({ id: "burst-c", createdAt: new Date("2025-12-31T23:58:00.000Z") }),
      activityRow({ id: "burst-b", createdAt: new Date("2025-12-31T23:56:00.000Z") }),
      activityRow({ id: "burst-a", createdAt: new Date("2025-12-31T23:54:00.000Z") }),
    ];
    loadFeedPageMock.mockResolvedValue({ rows: burst, hasNextPage: false });

    renderFeed(initialPage);
    latestObserver().trigger();

    await waitFor(() => expect(screen.getByText("Alan Turing made 3 changes")).not.toBeNull());
    expect(loadFeedPageMock).toHaveBeenCalledTimes(1);
  });
});