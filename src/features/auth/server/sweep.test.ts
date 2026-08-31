import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authAttempt, resetToken, session, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { startSweep, sweep } from "./sweep";

const NOW = new Date("2026-01-01T00:10:00.000Z");

beforeEach(async () => {
  await truncateTestDatabase();
});

async function insertUser() {
  const now = new Date();
  const [row] = await testDb
    .insert(user)
    .values({
      firstName: "Ada",
      lastName: "Lovelace",
      email: `ada-${crypto.randomUUID()}@example.com`,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertUser produced no row");
  }
  return row;
}

describe("sweep (FR-044, research C-6)", () => {
  it("removes auth_attempt rows older than fifteen minutes and leaves rows still inside the window", async () => {
    await testDb.insert(authAttempt).values([
      {
        flow: "signin",
        kind: "email",
        subject: "dead@example.com",
        attemptedAt: new Date(NOW.getTime() - 16 * 60 * 1000),
      },
      {
        flow: "signin",
        kind: "email",
        subject: "alive@example.com",
        attemptedAt: new Date(NOW.getTime() - 5 * 60 * 1000),
      },
    ]);

    await sweep(NOW);

    const rows = await testDb.select().from(authAttempt);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.subject).toBe("alive@example.com");
  });

  it("removes session rows past expiry and leaves live sessions", async () => {
    const owner = await insertUser();
    await testDb.insert(session).values([
      {
        userId: owner.id,
        tokenDigest: "a".repeat(64),
        createdAt: NOW,
        lastSeenAt: NOW,
        expiresAt: new Date(NOW.getTime() - 1000),
        ipAddress: "203.0.113.4",
      },
      {
        userId: owner.id,
        tokenDigest: "b".repeat(64),
        createdAt: NOW,
        lastSeenAt: NOW,
        expiresAt: new Date(NOW.getTime() + 1000),
        ipAddress: "203.0.113.4",
      },
    ]);

    await sweep(NOW);

    const rows = await testDb.select().from(session).where(eq(session.userId, owner.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenDigest).toBe("b".repeat(64));
  });

  it("removes reset_token rows that are spent or expired and leaves a valid one", async () => {
    const owner = await insertUser();
    await testDb.insert(resetToken).values([
      {
        userId: owner.id,
        tokenDigest: "c".repeat(64),
        expiresAt: new Date(NOW.getTime() + 60 * 60 * 1000),
        usedAt: NOW,
        createdAt: NOW,
      },
      {
        userId: owner.id,
        tokenDigest: "d".repeat(64),
        expiresAt: new Date(NOW.getTime() - 1000),
        usedAt: null,
        createdAt: NOW,
      },
      {
        userId: owner.id,
        tokenDigest: "e".repeat(64),
        expiresAt: new Date(NOW.getTime() + 60 * 60 * 1000),
        usedAt: null,
        createdAt: NOW,
      },
    ]);

    await sweep(NOW);

    const rows = await testDb.select().from(resetToken).where(eq(resetToken.userId, owner.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.tokenDigest).toBe("e".repeat(64));
  });

  it("cannot remove a row inside the live window even when it runs concurrently with a fresh insert", async () => {
    await testDb.insert(authAttempt).values({
      flow: "signin",
      kind: "email",
      subject: "old@example.com",
      attemptedAt: new Date(NOW.getTime() - 16 * 60 * 1000),
    });

    await Promise.all([
      sweep(NOW),
      testDb
        .insert(authAttempt)
        .values({ flow: "signin", kind: "email", subject: "fresh@example.com", attemptedAt: NOW }),
    ]);

    const rows = await testDb.select().from(authAttempt);
    expect(rows.map((row) => row.subject)).toEqual(["fresh@example.com"]);
  });
});

describe("sweep timer (FR-069, FR-070, FR-071)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("runs every five minutes and not sooner", async () => {
    const runSweep = vi.fn().mockResolvedValue(undefined);
    const stop = startSweep(runSweep);

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000 - 1);
    expect(runSweep).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(runSweep).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(runSweep).toHaveBeenCalledTimes(2);

    stop();
  });

  it("catches and logs a sweep that throws, without stopping the timer", async () => {
    const runSweep = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValue(undefined);
    const stop = startSweep(runSweep);

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(runSweep).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(runSweep).toHaveBeenCalledTimes(2);

    stop();
  });

  it("logs the failure through the unhandled-server-error event", async () => {
    const runSweep = vi.fn().mockRejectedValueOnce(new Error("boom"));
    const stop = startSweep(runSweep);

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);

    const lastCall = (console.error as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
    expect(String(lastCall)).toContain("unhandled_server_error");

    stop();
  });

  it("clears the timer on SIGTERM while letting a running sweep finish", async () => {
    let resolveSweep: () => void = () => undefined;
    const runSweep = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSweep = resolve;
        }),
    );
    startSweep(runSweep);

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(runSweep).toHaveBeenCalledTimes(1);

    process.emit("SIGTERM");
    resolveSweep();
    await Promise.resolve();

    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    expect(runSweep).toHaveBeenCalledTimes(1);
  });
});