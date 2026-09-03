import { describe, expect, it, vi } from "vitest";

const { requireActorMock } = vi.hoisted(() => ({ requireActorMock: vi.fn() }));
vi.mock("@/features/auth/server/actor", () => ({ requireActor: requireActorMock }));

const REDIRECT_ERROR = Object.assign(new Error("NEXT_REDIRECT"), {
  digest: "NEXT_REDIRECT;replace;/signin;307;",
});

const member = {
  id: "u1",
  role: "member",
  firstName: "Ada",
  lastName: "Lovelace",
  avatarUrl: null,
  mustChangePassword: false,
};

const admin = { ...member, id: "u2", role: "admin" };

const ADMIN_ONLY_ROUTES = [
  { name: "/projects/new", importPage: () => import("./projects/new/page"), params: undefined },
  { name: "/settings/accounts", importPage: () => import("./settings/accounts/page"), params: undefined },
  { name: "/settings/labels", importPage: () => import("./settings/labels/page"), params: undefined },
];

const DELIVERED_ADMIN_ROUTE_NAMES = new Set(["/projects/new", "/settings/accounts"]);
const UNDELIVERED_ADMIN_ROUTES = ADMIN_ONLY_ROUTES.filter(
  (route) => !DELIVERED_ADMIN_ROUTE_NAMES.has(route.name),
);

const SIGNED_IN_ROUTES = [
  { name: "/profile", importPage: () => import("./profile/page"), params: undefined },
  { name: "/notifications", importPage: () => import("./notifications/page"), params: undefined },
  {
    name: "/projects/[projectKey]",
    importPage: () => import("./projects/[projectKey]/page"),
    params: undefined,
  },
  {
    name: "/projects/[projectKey]/details",
    importPage: () => import("./projects/[projectKey]/details/page"),
    params: { projectKey: "WR" } as Record<string, string> | undefined,
  },
  {
    name: "/projects/[projectKey]/issues/new",
    importPage: () => import("./projects/[projectKey]/issues/new/page"),
    params: { projectKey: "WR" } as Record<string, string> | undefined,
  },
  {
    name: "/projects/[projectKey]/issues/[issueNumber]/details",
    importPage: () => import("./projects/[projectKey]/issues/[issueNumber]/details/page"),
    params: undefined,
  },
];

const DELIVERED_SIGNED_IN_ROUTE_NAMES = new Set([
  "/profile",
  "/projects/[projectKey]/details",
  "/projects/[projectKey]/issues/new",
]);
const UNDELIVERED_SIGNED_IN_ROUTES = SIGNED_IN_ROUTES.filter(
  (route) => !DELIVERED_SIGNED_IN_ROUTE_NAMES.has(route.name),
);

const ALL_ROUTES = [...ADMIN_ONLY_ROUTES, ...SIGNED_IN_ROUTES];

describe("Route guards (FR-014, FR-019, FR-021, FR-022, FR-029, research D-1)", () => {
  it.each(
    ALL_ROUTES,
  )("$name redirects to /signin and never reaches Forbidden for no actor (s3, SC-007)", async ({
    importPage,
    params,
  }) => {
    requireActorMock.mockImplementation(() => {
      throw REDIRECT_ERROR;
    });
    const { default: Page } = (await importPage()) as { default: (props?: unknown) => Promise<unknown> };

    await expect(Page(params ? { params: Promise.resolve(params) } : undefined)).rejects.toMatchObject({
      digest: expect.stringContaining(";/signin;") as string,
    });
  });

  it.each(ALL_ROUTES)("$name treats an expired session exactly as no session (s4)", async ({
    importPage,
    params,
  }) => {
    requireActorMock.mockImplementation(() => {
      throw REDIRECT_ERROR;
    });
    const { default: Page } = (await importPage()) as { default: (props?: unknown) => Promise<unknown> };

    await expect(Page(params ? { params: Promise.resolve(params) } : undefined)).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT") as string,
    });
  });

  it.each(
    ADMIN_ONLY_ROUTES,
  )("$name refuses a member with a real 403 at the requested URL (s1, s2, s7, SC-006)", async ({
    importPage,
  }) => {
    requireActorMock.mockResolvedValue(member);
    const { default: Page } = await importPage();

    await expect(Page()).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;403",
    });
  });

  it.each(
    UNDELIVERED_ADMIN_ROUTES,
  )("$name tells an admin the undelivered screen does not exist (s8, SC-014)", async ({ importPage }) => {
    requireActorMock.mockResolvedValue(admin);
    const { default: Page } = await importPage();

    await expect(Page()).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
  });

  it.each(UNDELIVERED_SIGNED_IN_ROUTES)("$name answers 404 for a signed-in member", async ({
    importPage,
  }) => {
    requireActorMock.mockResolvedValue(member);
    const { default: Page } = (await importPage()) as { default: () => Promise<unknown> };

    await expect(Page()).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
  });

  it.each(UNDELIVERED_SIGNED_IN_ROUTES)("$name answers 404 for a signed-in admin", async ({ importPage }) => {
    requireActorMock.mockResolvedValue(admin);
    const { default: Page } = (await importPage()) as { default: () => Promise<unknown> };

    await expect(Page()).rejects.toMatchObject({
      digest: "NEXT_HTTP_ERROR_FALLBACK;404",
    });
  });

  it("/profile renders the screen, rather than 404, for a signed-in member", async () => {
    requireActorMock.mockResolvedValue(member);
    const { default: Page } = await import("./profile/page");

    await expect(Page()).resolves.not.toBeNull();
  });
});