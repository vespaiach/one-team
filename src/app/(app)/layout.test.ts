import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadActorMock, listProjectsForSidebarMock } = vi.hoisted(() => ({
  loadActorMock: vi.fn(),
  listProjectsForSidebarMock: vi.fn(),
}));
vi.mock("@/features/auth/server/actor", () => ({ loadActor: loadActorMock }));
vi.mock("@/features/projects/server/queries", () => ({ listProjectsForSidebar: listProjectsForSidebarMock }));

describe("(app)/layout.tsx (FR-002, FR-015, FR-033, FR-053, contracts/app-shell.md, contracts/ux-conventions.md)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("wraps children in AppShell when an actor is present, alongside a single toast region", async () => {
    loadActorMock.mockResolvedValue({
      id: "u1",
      role: "member",
      firstName: "Ada",
      lastName: "Lovelace",
      avatarUrl: null,
      mustChangePassword: false,
    });
    listProjectsForSidebarMock.mockResolvedValue([{ key: "WR", name: "Website Redesign", status: "active" }]);

    const { default: AppLayout } = await import("./layout");
    const { AppShell } = await import("@/features/shell/components/app-shell");
    const { ToastRegion } = await import("@/features/shell/components/toast-region");
    const children = createElement("p", null, "page content");

    const result = await AppLayout({ children });

    expect(isValidElement(result)).toBe(true);
    if (!isValidElement<{ children: ReactNode }>(result)) {
      throw new Error("expected a React element");
    }
    const siblings = Children.toArray(result.props.children) as ReactElement[];
    const shellElement = siblings.find((sibling) => sibling.type === AppShell);
    const toastElements = siblings.filter((sibling) => sibling.type === ToastRegion);

    expect(shellElement).toBeDefined();
    expect((shellElement as ReactElement<{ children: ReactNode }>).props.children).toBe(children);
    expect((shellElement as ReactElement<{ projects: unknown }>).props.projects).toEqual([
      { key: "WR", name: "Website Redesign", status: "active" },
    ]);
    expect(toastElements).toHaveLength(1);
  });

  it("renders exactly its children, with no frame, when there is no actor", async () => {
    loadActorMock.mockResolvedValue(null);

    const { default: AppLayout } = await import("./layout");
    const children = createElement("p", null, "page content");

    const result = await AppLayout({ children });

    expect(result).toBe(children);
    expect(listProjectsForSidebarMock).not.toHaveBeenCalled();
  });

  it("performs no authorization check of its own — it never redirects and never throws", async () => {
    loadActorMock.mockResolvedValue(null);

    const { default: AppLayout } = await import("./layout");
    const children = createElement("p", null, "page content");

    await expect(AppLayout({ children })).resolves.not.toThrow();
  });
});