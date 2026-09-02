import { Children, createElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const { loadActorMock } = vi.hoisted(() => ({ loadActorMock: vi.fn() }));
vi.mock("@/features/auth/server/actor", () => ({ loadActor: loadActorMock }));

describe("(app)/layout.tsx (FR-002, FR-015, FR-033, contracts/app-shell.md, contracts/ux-conventions.md)", () => {
  it("wraps children in AppShell when an actor is present, alongside a single toast region", async () => {
    loadActorMock.mockResolvedValue({
      id: "u1",
      role: "member",
      firstName: "Ada",
      lastName: "Lovelace",
      avatarUrl: null,
      mustChangePassword: false,
    });

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
    expect(toastElements).toHaveLength(1);
  });

  it("renders exactly its children, with no frame, when there is no actor", async () => {
    loadActorMock.mockResolvedValue(null);

    const { default: AppLayout } = await import("./layout");
    const children = createElement("p", null, "page content");

    const result = await AppLayout({ children });

    expect(result).toBe(children);
  });

  it("performs no authorization check of its own — it never redirects and never throws", async () => {
    loadActorMock.mockResolvedValue(null);

    const { default: AppLayout } = await import("./layout");
    const children = createElement("p", null, "page content");

    await expect(AppLayout({ children })).resolves.not.toThrow();
  });
});