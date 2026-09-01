import { describe, expect, it, vi } from "vitest";

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

describe("/home (FR-003, s3)", () => {
  it("calls requireActor before rendering anything", async () => {
    requireActorMock.mockResolvedValue(actor);
    const { default: HomePage } = await import("./page");

    await HomePage();

    expect(requireActorMock).toHaveBeenCalledTimes(1);
  });

  it("renders no header — no title block, no per-screen control, no New issue control", async () => {
    requireActorMock.mockResolvedValue(actor);
    const { default: HomePage } = await import("./page");

    const result = await HomePage();

    expect(result).toBeNull();
  });

  it("redirects to /signin rather than rendering, when there is no actor", async () => {
    requireActorMock.mockImplementation(() => {
      throw Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/signin;307;" });
    });
    const { default: HomePage } = await import("./page");

    await expect(HomePage()).rejects.toMatchObject({
      digest: expect.stringContaining(";/signin;") as string,
    });
  });
});