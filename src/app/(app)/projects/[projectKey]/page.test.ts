import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/server/actor", () => ({
  requireActor: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  forbidden: vi.fn(() => {
    throw new Error("NEXT_FORBIDDEN");
  }),
}));
vi.mock("@/features/board/server/board-queries", () => ({
  loadBoard: vi.fn(),
}));
vi.mock("@/features/activity/server/feed-queries", () => ({
  countProjectComments: vi.fn(),
}));

import { forbidden, notFound } from "next/navigation";
import { isValidElement, type ReactElement, type ReactNode, Suspense } from "react";
import { countProjectComments } from "@/features/activity/server/feed-queries";
import { requireActor } from "@/features/auth/server/actor";
import { BoardScreen } from "@/features/board/components/board-screen";
import { BoardSkeleton } from "@/features/board/components/board-skeleton";
import { type BoardView, loadBoard } from "@/features/board/server/board-queries";
import { ProjectHeader } from "@/features/projects/components/project-header";
import ProjectBoardPage from "./page";

const ACTOR = {
  id: "0198d2b1-0000-7000-8000-0000000000a1",
  role: "member" as const,
  firstName: "Ada",
  lastName: "Lovelace",
  avatarUrl: null,
  mustChangePassword: false,
};

function boardView(overrides: Partial<BoardView> = {}): BoardView {
  return {
    project: {
      id: "0198d2b1-0000-7000-8000-0000000000b1",
      key: "WEB",
      name: "Website Redesign",
      status: "active",
    },
    columns: [{ id: "0198d2b1-0000-7000-8000-0000000000c1", name: "Backlog" }],
    cards: [],
    assigneePool: [],
    assignedOutsidePool: [],
    canWrite: true,
    writeReason: "",
    ...overrides,
  };
}

function params(projectKey: string) {
  return { params: Promise.resolve({ projectKey }) };
}

function elements(node: ReactNode): ReactElement<{ children?: ReactNode }>[] {
  if (Array.isArray(node)) {
    return node.flatMap(elements);
  }
  if (!isValidElement(node)) {
    return [];
  }
  const element = node as ReactElement<{ children?: ReactNode }>;
  return [element, ...elements(element.props.children)];
}

function typeName(element: ReactElement): string {
  const { type } = element;
  if (typeof type === "string") {
    return type;
  }
  if (typeof type === "function") {
    return type.name;
  }
  return String(type);
}

function shape(node: ReactNode): string[] {
  return elements(node).map(
    (element) =>
      `${typeName(element)}(${Object.keys(element.props as object)
        .sort()
        .join(",")})`,
  );
}

function findByType(node: ReactNode, type: unknown): ReactElement<Record<string, unknown>> | undefined {
  return elements(node).find((element) => element.type === type) as
    | ReactElement<Record<string, unknown>>
    | undefined;
}

async function insideBoundary(node: ReactNode): Promise<ReactNode> {
  const boundary = findByType(node, Suspense);
  const child = boundary?.props.children as ReactElement<Record<string, unknown>>;
  const render = child.type as (props: Record<string, unknown>) => Promise<ReactNode>;
  return render(child.props);
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("/projects/:projectKey board page — who gets in (FR-002, FR-003)", () => {
  it("redirects an unauthenticated caller to sign-in and never reads the board", async () => {
    vi.mocked(requireActor).mockImplementation(() => {
      throw new Error("NEXT_REDIRECT:/signin");
    });

    await expect(ProjectBoardPage(params("WEB"))).rejects.toThrow("NEXT_REDIRECT:/signin");

    expect(loadBoard).not.toHaveBeenCalled();
    expect(notFound).not.toHaveBeenCalled();
    expect(forbidden).not.toHaveBeenCalled();
  });

  it("awaits requireActor() before the board read", async () => {
    const order: string[] = [];
    vi.mocked(requireActor).mockImplementation(async () => {
      order.push("requireActor");
      return ACTOR;
    });
    vi.mocked(loadBoard).mockImplementation(async () => {
      order.push("loadBoard");
      return boardView();
    });

    await insideBoundary(await ProjectBoardPage(params("WEB")));

    expect(order).toEqual(["requireActor", "loadBoard"]);
  });

  it("awaits params and reads the board for the key it resolves to", async () => {
    vi.mocked(requireActor).mockResolvedValue(ACTOR);
    vi.mocked(loadBoard).mockResolvedValue(boardView());

    await insideBoundary(await ProjectBoardPage(params("WEB")));

    expect(loadBoard).toHaveBeenCalledWith("WEB", ACTOR);
  });

  it("answers 'This doesn't exist' for a key no project holds", async () => {
    vi.mocked(requireActor).mockResolvedValue(ACTOR);
    vi.mocked(loadBoard).mockResolvedValue(null);

    await expect(insideBoundary(await ProjectBoardPage(params("NOPE")))).rejects.toThrow("NEXT_NOT_FOUND");

    expect(notFound).toHaveBeenCalled();
  });

  it("never calls forbidden(): a signed-in non-member reads the board and is refused only the writes", async () => {
    vi.mocked(requireActor).mockResolvedValue(ACTOR);
    vi.mocked(loadBoard).mockResolvedValue(
      boardView({ canWrite: false, writeReason: "You're not a member of Website Redesign." }),
    );

    const inside = await insideBoundary(await ProjectBoardPage(params("WEB")));

    expect(forbidden).not.toHaveBeenCalled();
    expect(notFound).not.toHaveBeenCalled();
    expect(findByType(inside, BoardScreen)).toBeDefined();
  });
});

describe("/projects/:projectKey board page — what it renders (FR-004, FR-007)", () => {
  it("renders ProjectHeader on the board tab, naming the project", async () => {
    vi.mocked(requireActor).mockResolvedValue(ACTOR);
    vi.mocked(loadBoard).mockResolvedValue(boardView());

    const header = findByType(await insideBoundary(await ProjectBoardPage(params("WEB"))), ProjectHeader);

    expect(header?.props.current).toBe("board");
    expect(header?.props.projectKey).toBe("WEB");
    expect(header?.props.name).toBe("Website Redesign");
  });

  it("gives the header the project's comment count", async () => {
    vi.mocked(requireActor).mockResolvedValue(ACTOR);
    const view = boardView();
    vi.mocked(loadBoard).mockResolvedValue(view);
    vi.mocked(countProjectComments).mockResolvedValue(7);

    const header = findByType(await insideBoundary(await ProjectBoardPage(params("WEB"))), ProjectHeader);

    expect(countProjectComments).toHaveBeenCalledWith(view.project.id);
    expect(header?.props.commentCount).toBe(7);
  });

  it("reads the board inside the Suspense boundary rather than before it", async () => {
    vi.mocked(requireActor).mockResolvedValue(ACTOR);
    const view = boardView();
    vi.mocked(loadBoard).mockResolvedValue(view);

    const jsx = await ProjectBoardPage(params("WEB"));

    expect(loadBoard).not.toHaveBeenCalled();

    const inside = await insideBoundary(jsx);

    expect(loadBoard).toHaveBeenCalledWith("WEB", ACTOR);
    expect(findByType(inside, BoardScreen)?.props.board).toBe(view);
  });

  it("renders the client board inside a Suspense boundary whose fallback is the lane-shaped skeleton", async () => {
    vi.mocked(requireActor).mockResolvedValue(ACTOR);
    const view = boardView();
    vi.mocked(loadBoard).mockResolvedValue(view);

    const jsx = await ProjectBoardPage(params("WEB"));
    const boundary = findByType(jsx, Suspense);

    expect(boundary).toBeDefined();
    expect(findByType(boundary?.props.fallback as ReactNode, BoardSkeleton)).toBeDefined();
    expect(findByType(await insideBoundary(jsx), BoardScreen)?.props.board).toBe(view);
  });
});

describe("/projects/:projectKey board page — an archived project (US1 sc.9-12)", () => {
  it("renders exactly what an active project renders", async () => {
    vi.mocked(requireActor).mockResolvedValue(ACTOR);

    vi.mocked(loadBoard).mockResolvedValue(boardView());
    const active = shape(await insideBoundary(await ProjectBoardPage(params("WEB"))));

    const archived = boardView();
    archived.project.status = "archived";
    vi.mocked(loadBoard).mockResolvedValue(archived);
    const jsx = await insideBoundary(await ProjectBoardPage(params("WEB")));

    expect(shape(jsx)).toEqual(active);
    expect(notFound).not.toHaveBeenCalled();
    expect(forbidden).not.toHaveBeenCalled();
  });
});