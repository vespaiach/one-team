import { render, screen, within } from "@testing-library/react";
import { useDragAndDrop } from "react-aria-components/useDragAndDrop";
import { describe, expect, it, vi } from "vitest";
import type { Lane } from "../lane-model";
import type { BoardCard } from "../server/board-queries";
import { BoardLane } from "./board-lane";

vi.mock("react-aria-components/useDragAndDrop", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-aria-components/useDragAndDrop")>();
  return { ...actual, useDragAndDrop: vi.fn(actual.useDragAndDrop) };
});

function card(id: string, key: string, title: string, order: number): BoardCard {
  return {
    id,
    key,
    title,
    columnId: "0198d2b1-0000-7000-8000-0000000000c1",
    assigneeId: null,
    priority: "none",
    dueDate: null,
    labels: [],
    assignee: null,
    commentCount: 0,
    order,
  };
}

function lane(cards: BoardCard[]): Lane<BoardCard> {
  return { id: "0198d2b1-0000-7000-8000-0000000000c1", name: "In Progress", cards };
}

const THREE_CARDS = [
  card("0198d2b1-0000-7000-8000-000000000001", "WEB-7", "Rework the sign-in copy", 4),
  card("0198d2b1-0000-7000-8000-000000000002", "WEB-2", "Audit the empty states", 1),
  card("0198d2b1-0000-7000-8000-000000000003", "WEB-9", "Drop the unused tokens", 9),
];

describe("BoardLane — its name and its live count (FR-009)", () => {
  it("shows the lane's name", () => {
    render(
      <BoardLane
        lane={lane(THREE_CARDS)}
        projectKey="WEB"
      />,
    );

    expect(screen.getByRole("heading", { name: "In Progress" })).not.toBeNull();
  });

  it("shows the number of cards currently rendered in it, not a number handed to it", () => {
    const { rerender } = render(
      <BoardLane
        lane={lane(THREE_CARDS)}
        projectKey="WEB"
      />,
    );

    expect(screen.getByText("3")).not.toBeNull();
    expect(screen.getAllByRole("row")).toHaveLength(3);

    rerender(
      <BoardLane
        lane={lane(THREE_CARDS.slice(0, 2))}
        projectKey="WEB"
      />,
    );

    expect(screen.getByText("2")).not.toBeNull();
    expect(screen.getAllByRole("row")).toHaveLength(2);
  });
});

describe("BoardLane — an empty lane (FR-008)", () => {
  it("shows one quiet line and nothing else where the cards would be", () => {
    render(
      <BoardLane
        lane={lane([])}
        projectKey="WEB"
      />,
    );

    expect(screen.getAllByText("No cards")).toHaveLength(1);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(screen.getByText("0")).not.toBeNull();
  });

  it("renders no illustration for the empty lane", () => {
    const { container } = render(
      <BoardLane
        lane={lane([])}
        projectKey="WEB"
      />,
    );

    expect(container.querySelectorAll("svg")).toHaveLength(0);
    expect(container.querySelectorAll("img")).toHaveLength(0);
    expect(screen.queryAllByRole("img")).toHaveLength(0);
  });
});

describe("BoardLane — the lane is a named drop target (FR-043)", () => {
  it("is a GridList whose accessible name is the lane's name", () => {
    render(
      <BoardLane
        lane={lane(THREE_CARDS)}
        projectKey="WEB"
      />,
    );

    expect(screen.getByRole("grid", { name: "In Progress" })).not.toBeNull();
  });

  it("names every card row by the issue's key and title", () => {
    render(
      <BoardLane
        lane={lane(THREE_CARDS)}
        projectKey="WEB"
      />,
    );

    expect(screen.getByRole("row", { name: "WEB-7 Rework the sign-in copy" })).not.toBeNull();
  });
});

describe("BoardLane — it renders the order it is handed (FR-023)", () => {
  it("renders the cards in exactly the sequence given and performs no sort of its own", () => {
    render(
      <BoardLane
        lane={lane(THREE_CARDS)}
        projectKey="WEB"
      />,
    );

    const grid = screen.getByRole("grid", { name: "In Progress" });
    const keys = within(grid)
      .getAllByRole("row")
      .map((row) => within(row).getByText(/^WEB-/).textContent);

    expect(keys).toEqual(["WEB-7", "WEB-2", "WEB-9"]);
  });

  it("renders a reversed sequence just as it arrives", () => {
    render(
      <BoardLane
        lane={lane([...THREE_CARDS].reverse())}
        projectKey="WEB"
      />,
    );

    const grid = screen.getByRole("grid", { name: "In Progress" });
    const keys = within(grid)
      .getAllByRole("row")
      .map((row) => within(row).getByText(/^WEB-/).textContent);

    expect(keys).toEqual(["WEB-9", "WEB-2", "WEB-7"]);
  });
});

describe("BoardLane — a lane that accepts no drop (FR-037, US3 sc.12)", () => {
  function refusingLane(cards: BoardCard[]) {
    return { ...lane(cards), name: "Barbara Liskov", canAcceptDrop: false };
  }

  function dropOperationOf(): string | undefined {
    const options = vi.mocked(useDragAndDrop).mock.calls.at(-1)?.[0];
    return options?.getDropOperation?.({ type: "root" }, { has: () => true }, ["move"]);
  }

  it("answers cancel from getDropOperation", () => {
    render(
      <BoardLane
        lane={refusingLane(THREE_CARDS)}
        projectKey="WEB"
      />,
    );

    expect(dropOperationOf()).toBe("cancel");
  });

  it("still accepts a drop on a lane that has not been closed", () => {
    render(
      <BoardLane
        lane={{ ...lane(THREE_CARDS), canAcceptDrop: true }}
        projectKey="WEB"
      />,
    );

    expect(dropOperationOf()).toBe("move");
  });

  it("neither hides its cards nor swallows its name and its count", () => {
    render(
      <BoardLane
        lane={refusingLane(THREE_CARDS)}
        projectKey="WEB"
      />,
    );

    expect(screen.getByRole("heading", { name: "Barbara Liskov" })).not.toBeNull();
    expect(screen.getByText("3")).not.toBeNull();
    expect(within(screen.getByRole("grid", { name: "Barbara Liskov" })).getAllByRole("row")).toHaveLength(3);
  });
});