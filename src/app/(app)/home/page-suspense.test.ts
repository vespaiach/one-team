import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { isValidElement, type ReactElement, type ReactNode, Suspense } from "react";
import { describe, expect, it, vi } from "vitest";
import { displayName } from "@/lib/display-name";

const { requireActorMock } = vi.hoisted(() => ({ requireActorMock: vi.fn() }));
vi.mock("@/features/auth/server/actor", () => ({ requireActor: requireActorMock }));

const actor = {
  id: "u1",
  role: "member",
  firstName: "Ada",
  lastName: "Lovelace",
  avatarUrl: null,
  mustChangePassword: false,
};

const routeDirectory = fileURLToPath(new URL("./", import.meta.url));
const featureDirectory = fileURLToPath(new URL("../../../features/home/", import.meta.url));

const pairs = [
  ["StatCards", "StatCardsSkeleton"],
  ["AssignedSection", "AssignedSkeleton"],
  ["ProjectsSection", "ProjectsSkeleton"],
  ["MentionsSection", "MentionsSkeleton"],
  ["ActivitySection", "ActivitySkeleton"],
];

type SurfaceProps = { children?: ReactNode; fallback?: ReactNode };

function elements(node: ReactNode): ReactElement<SurfaceProps>[] {
  if (Array.isArray(node)) {
    return node.flatMap(elements);
  }
  if (!isValidElement(node)) {
    return [];
  }
  const element = node as ReactElement<SurfaceProps>;
  return [element, ...elements(element.props.children)];
}

function nameOf(node: ReactNode): string {
  const [element] = elements(node);
  if (element === undefined) {
    return "";
  }
  const { type } = element;
  if (typeof type === "string") {
    return type;
  }
  if (typeof type === "function") {
    return type.name;
  }
  return String(type);
}

function text(node: ReactNode): string {
  if (Array.isArray(node)) {
    return node.map(text).join("");
  }
  if (typeof node === "string") {
    return node;
  }
  if (typeof node === "number") {
    return String(node);
  }
  if (isValidElement(node)) {
    const element = node as ReactElement<{ children?: ReactNode }>;
    return text(element.props.children);
  }
  return "";
}

function boundaries(node: ReactNode): ReactElement<SurfaceProps>[] {
  return elements(node).filter((element) => element.type === Suspense);
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name) && !entry.name.includes(".test."))
    .map((entry) => `${entry.parentPath}/${entry.name}`);
}

describe("/home loading boundaries (FR-038, US5 s3, SC-011, D-1)", () => {
  it("puts each of the five surfaces in its own Suspense with its own section skeleton as fallback", async () => {
    requireActorMock.mockResolvedValue(actor);
    const { default: HomePage } = await import("./page");

    const mounted = boundaries(await HomePage()).map((boundary) => [
      nameOf(boundary.props.children),
      nameOf(boundary.props.fallback),
    ]);

    expect(mounted).toEqual(pairs);
  });

  it("keeps the five boundaries siblings — none nested inside another, so one slow section never withholds the rest", async () => {
    requireActorMock.mockResolvedValue(actor);
    const { default: HomePage } = await import("./page");

    for (const boundary of boundaries(await HomePage())) {
      expect(boundaries(boundary.props.children)).toHaveLength(0);
      expect(boundaries(boundary.props.fallback)).toHaveLength(0);
    }
  });

  it("renders the greeting outside every boundary — it needs only the awaited actor", async () => {
    requireActorMock.mockResolvedValue(actor);
    const { default: HomePage } = await import("./page");

    const result = await HomePage();

    expect(text(result)).toContain(displayName(actor));

    for (const boundary of boundaries(result)) {
      expect(text(boundary.props.children)).not.toContain(displayName(actor));
      expect(text(boundary.props.fallback)).not.toContain(displayName(actor));
    }
  });

  it("places every boundary below the awaited requireActor(), so an actor-less request streams no fallback", async () => {
    requireActorMock.mockImplementation(() => {
      throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/signin;307;" });
    });
    const { default: HomePage } = await import("./page");

    await expect(HomePage()).rejects.toMatchObject({
      digest: expect.stringContaining(";/signin;") as string,
    });

    const source = readFileSync(`${routeDirectory}page.tsx`, "utf8");

    expect(source.indexOf("await requireActor()")).toBeGreaterThan(-1);
    expect(source.indexOf("<Suspense")).toBeGreaterThan(source.indexOf("await requireActor()"));
  });

  it("adds no loading.tsx under the route — it would sit above the guard and stream a 200 before the redirect", () => {
    expect(readdirSync(routeDirectory).filter((entry) => entry.startsWith("loading."))).toEqual([]);
  });

  it("renders no full-screen spinner anywhere — every fallback is a busy skeleton of its section's own geometry", async () => {
    requireActorMock.mockResolvedValue(actor);
    const { default: HomePage } = await import("./page");

    for (const boundary of boundaries(await HomePage())) {
      const [fallback] = elements(boundary.props.fallback);
      const skeleton = fallback.type as (props: unknown) => ReactNode;
      const [root] = elements(skeleton(fallback.props));

      expect(root.props).toMatchObject({ "aria-busy": "true" });
    }

    for (const file of [...sourceFiles(featureDirectory), ...sourceFiles(routeDirectory)]) {
      const source = readFileSync(file, "utf8");

      expect(source).not.toMatch(/animate-spin|role="progressbar"|role="status"|Spinner|fixed inset-0/);
    }
  });
});