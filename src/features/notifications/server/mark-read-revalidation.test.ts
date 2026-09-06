import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { refreshMock, requireActorMock, markReadMock, markAllReadMock } = vi.hoisted(() => ({
  refreshMock: vi.fn(),
  requireActorMock: vi.fn(),
  markReadMock: vi.fn(),
  markAllReadMock: vi.fn(),
}));

vi.mock("next/cache", () => ({ refresh: refreshMock }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/features/auth/server/actor", () => ({ requireActor: requireActorMock }));
vi.mock("@/features/auth/server/origin", () => ({ assertSameOrigin: () => undefined }));
vi.mock("./mark-read", () => ({
  markNotificationRead: markReadMock,
  markAllNotificationsRead: markAllReadMock,
}));

const { markAllNotificationsRead, markNotificationRead } = await import("../actions");

const NOTIFICATION_ID = "0195f2b0-0000-7000-8000-000000000001";

beforeEach(() => {
  refreshMock.mockReset();
  markReadMock.mockReset();
  markAllReadMock.mockReset();
  requireActorMock.mockResolvedValue({ id: "u1", role: "member" });
});

describe("revalidation on mutation is the only refresh mechanism (FR-036, SC-012)", () => {
  it("refreshes the shell when a single row is marked read", async () => {
    markReadMock.mockResolvedValue("ok");

    await expect(markNotificationRead({ notificationId: NOTIFICATION_ID })).resolves.toEqual({
      status: "ok",
    });

    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("refreshes nothing when the row was not the caller's to mark", async () => {
    markReadMock.mockResolvedValue("not-found");

    await expect(markNotificationRead({ notificationId: NOTIFICATION_ID })).resolves.toEqual({
      status: "not-found",
    });

    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("refreshes nothing when the identifier never reached the writer", async () => {
    await expect(markNotificationRead({ notificationId: "   " })).resolves.toEqual({
      status: "not-found",
    });

    expect(markReadMock).not.toHaveBeenCalled();
    expect(refreshMock).not.toHaveBeenCalled();
  });

  it("refreshes the shell unconditionally when everything is marked read", async () => {
    markAllReadMock.mockResolvedValue(undefined);

    await expect(markAllNotificationsRead()).resolves.toEqual({ status: "ok" });

    expect(markAllReadMock).toHaveBeenCalledWith("u1");
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });
});

describe("no polling, no socket and no live push carries the count (FR-036)", () => {
  const roots = [
    join(process.cwd(), "src", "features", "notifications"),
    join(process.cwd(), "src", "features", "shell", "components"),
    join(process.cwd(), "src", "app", "(app)"),
  ];
  const forbidden = [/setInterval/, /WebSocket/, /EventSource/, /new SharedWorker/, /pushManager/];

  async function sourceFiles(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const found: string[] = [];
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        found.push(...(await sourceFiles(path)));
      } else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
        found.push(path);
      }
    }
    return found;
  }

  it("introduces no timer, socket or push anywhere the count is read or written", async () => {
    const offenders: string[] = [];
    for (const root of roots) {
      for (const path of await sourceFiles(root)) {
        const source = await readFile(path, "utf8");
        if (forbidden.some((pattern) => pattern.test(source))) {
          offenders.push(path);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});