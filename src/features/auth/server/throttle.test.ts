import { and, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { authAttempt } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { assertNotThrottled, clearSignInAttempts, recordFailure, ThrottledError } from "./throttle";

const NOW = new Date("2026-01-01T00:10:00.000Z");

beforeEach(async () => {
  await truncateTestDatabase();
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function insertAttempts(
  flow: "signin" | "reset",
  kind: "email" | "ip",
  subject: string,
  count: number,
  attemptedAt: Date,
) {
  for (let i = 0; i < count; i += 1) {
    await testDb.insert(authAttempt).values({ flow, kind, subject, attemptedAt });
  }
}

describe("throttle — limits and window (FR-039, FR-042, SC-005)", () => {
  it("refuses sign-in at five failures for one address", async () => {
    await insertAttempts("signin", "email", "ada@example.com", 5, new Date(NOW.getTime() - 60_000));

    await expect(
      assertNotThrottled({ flow: "signin", email: "ada@example.com", ip: "203.0.113.4", now: NOW }),
    ).rejects.toThrow(ThrottledError);
  });

  it("allows sign-in at four failures for one address", async () => {
    await insertAttempts("signin", "email", "ada@example.com", 4, new Date(NOW.getTime() - 60_000));

    await expect(
      assertNotThrottled({ flow: "signin", email: "ada@example.com", ip: "203.0.113.4", now: NOW }),
    ).resolves.toBeUndefined();
  });

  it("refuses sign-in at twenty failures from one IP across many addresses", async () => {
    await insertAttempts("signin", "ip", "203.0.113.4", 20, new Date(NOW.getTime() - 60_000));

    await expect(
      assertNotThrottled({
        flow: "signin",
        email: `user-${crypto.randomUUID()}@example.com`,
        ip: "203.0.113.4",
        now: NOW,
      }),
    ).rejects.toThrow(ThrottledError);
  });

  it("allows sign-in at nineteen failures from one IP", async () => {
    await insertAttempts("signin", "ip", "203.0.113.4", 19, new Date(NOW.getTime() - 60_000));

    await expect(
      assertNotThrottled({
        flow: "signin",
        email: `user-${crypto.randomUUID()}@example.com`,
        ip: "203.0.113.4",
        now: NOW,
      }),
    ).resolves.toBeUndefined();
  });

  it("does not count attempts outside the fifteen-minute window", async () => {
    await insertAttempts("signin", "email", "ada@example.com", 5, new Date(NOW.getTime() - 16 * 60 * 1000));

    await expect(
      assertNotThrottled({ flow: "signin", email: "ada@example.com", ip: "203.0.113.4", now: NOW }),
    ).resolves.toBeUndefined();
  });
});

describe("throttle — retryAfterSeconds (FR-039, FR-068)", () => {
  it("derives the refusal's remaining time from the oldest attempt still inside the window", async () => {
    await testDb.insert(authAttempt).values(
      [14, 10, 5, 2, 1].map((minutesAgo) => ({
        flow: "signin" as const,
        kind: "email" as const,
        subject: "ada@example.com",
        attemptedAt: new Date(NOW.getTime() - minutesAgo * 60 * 1000),
      })),
    );

    const error = await assertNotThrottled({
      flow: "signin",
      email: "ada@example.com",
      ip: "203.0.113.4",
      now: NOW,
    }).catch((caught) => caught);

    expect(error).toBeInstanceOf(ThrottledError);
    expect((error as ThrottledError).retryAfterSeconds).toBe(60);
  });

  it("reports the later of the two clearing instants where both limits hold", async () => {
    const emailOldest = new Date(NOW.getTime() - 2 * 60 * 1000);
    const ipOldest = new Date(NOW.getTime() - 10 * 60 * 1000);
    await testDb.insert(authAttempt).values([
      ...Array.from({ length: 5 }, () => ({
        flow: "signin" as const,
        kind: "email" as const,
        subject: "ada@example.com",
        attemptedAt: emailOldest,
      })),
      ...Array.from({ length: 20 }, () => ({
        flow: "signin" as const,
        kind: "ip" as const,
        subject: "203.0.113.4",
        attemptedAt: ipOldest,
      })),
    ]);

    const error = await assertNotThrottled({
      flow: "signin",
      email: "ada@example.com",
      ip: "203.0.113.4",
      now: NOW,
    }).catch((caught) => caught);

    expect(error).toBeInstanceOf(ThrottledError);
    expect((error as ThrottledError).retryAfterSeconds).toBe(13 * 60);
  });
});

describe("throttle — flow isolation (FR-040, SC-007)", () => {
  it("a reset lockout does not block sign-in for the same address", async () => {
    await insertAttempts("reset", "email", "ada@example.com", 5, new Date(NOW.getTime() - 60_000));

    await expect(
      assertNotThrottled({ flow: "signin", email: "ada@example.com", ip: "203.0.113.4", now: NOW }),
    ).resolves.toBeUndefined();
  });

  it("a sign-in lockout does not block the reset that would fix it", async () => {
    await insertAttempts("signin", "email", "ada@example.com", 5, new Date(NOW.getTime() - 60_000));

    await expect(
      assertNotThrottled({ flow: "reset", email: "ada@example.com", ip: "203.0.113.4", now: NOW }),
    ).resolves.toBeUndefined();
  });
});

describe("throttle — refusals record nothing (FR-041)", () => {
  it("a refused check inserts no row", async () => {
    await insertAttempts("signin", "email", "ada@example.com", 5, new Date(NOW.getTime() - 60_000));

    await expect(
      assertNotThrottled({ flow: "signin", email: "ada@example.com", ip: "203.0.113.4", now: NOW }),
    ).rejects.toThrow(ThrottledError);

    const rows = await testDb.select().from(authAttempt).where(eq(authAttempt.subject, "ada@example.com"));
    expect(rows).toHaveLength(5);
  });
});

describe("throttle — clearSignInAttempts (FR-018)", () => {
  it("clears only that address's (signin, email) rows, leaving its reset rows and the IP's rows", async () => {
    await insertAttempts("signin", "email", "ada@example.com", 4, new Date(NOW.getTime() - 60_000));
    await insertAttempts("reset", "email", "ada@example.com", 3, new Date(NOW.getTime() - 60_000));
    await insertAttempts("signin", "ip", "203.0.113.4", 2, new Date(NOW.getTime() - 60_000));

    await clearSignInAttempts("ada@example.com");

    const remaining = await testDb.select().from(authAttempt);
    expect(remaining).toHaveLength(5);
    expect(remaining.some((row) => row.flow === "signin" && row.kind === "email")).toBe(false);
  });
});

describe("throttle — concurrency (FR-041, research C-5)", () => {
  it("two transactions racing the fifth failure both record durably under the advisory lock, refusing the very next check", async () => {
    await insertAttempts("signin", "email", "ada@example.com", 4, new Date(NOW.getTime() - 60_000));

    await Promise.all([
      recordFailure({ flow: "signin", email: "ada@example.com", ip: "203.0.113.4", now: NOW }),
      recordFailure({ flow: "signin", email: "ada@example.com", ip: "203.0.113.5", now: NOW }),
    ]);

    const rows = await testDb
      .select()
      .from(authAttempt)
      .where(
        and(
          eq(authAttempt.flow, "signin"),
          eq(authAttempt.kind, "email"),
          eq(authAttempt.subject, "ada@example.com"),
        ),
      );
    expect(rows).toHaveLength(6);

    await expect(
      assertNotThrottled({ flow: "signin", email: "ada@example.com", ip: "203.0.113.6", now: NOW }),
    ).rejects.toThrow(ThrottledError);
  });
});

describe("throttle — logs a refusal (FR-064)", () => {
  it("writes a throttle_refusal event when it refuses", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "error").mockImplementation((line: unknown) => {
      lines.push(String(line));
    });
    await insertAttempts("signin", "email", "ada@example.com", 5, new Date(NOW.getTime() - 60_000));

    await assertNotThrottled({ flow: "signin", email: "ada@example.com", ip: "203.0.113.4", now: NOW }).catch(
      () => undefined,
    );

    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0] ?? "{}").event).toBe("throttle_refusal");
  });

  it("writes no event when it allows the request through", async () => {
    const lines: string[] = [];
    vi.spyOn(console, "error").mockImplementation((line: unknown) => {
      lines.push(String(line));
    });

    await assertNotThrottled({ flow: "signin", email: "ada@example.com", ip: "203.0.113.4", now: NOW });

    expect(lines).toHaveLength(0);
  });
});

describe("throttle — durability across a restart (FR-043, SC-006)", () => {
  it("reads counters from rows alone, with no process-local state to lose on restart", async () => {
    await recordFailure({ flow: "signin", email: "ada@example.com", ip: "203.0.113.4", now: NOW });
    await recordFailure({ flow: "signin", email: "ada@example.com", ip: "203.0.113.4", now: NOW });
    await recordFailure({ flow: "signin", email: "ada@example.com", ip: "203.0.113.4", now: NOW });
    await recordFailure({ flow: "signin", email: "ada@example.com", ip: "203.0.113.4", now: NOW });
    await recordFailure({ flow: "signin", email: "ada@example.com", ip: "203.0.113.4", now: NOW });

    const rows = await testDb.select().from(authAttempt).where(eq(authAttempt.subject, "ada@example.com"));
    expect(rows.filter((row) => row.kind === "email")).toHaveLength(5);

    await expect(
      assertNotThrottled({ flow: "signin", email: "ada@example.com", ip: "203.0.113.99", now: NOW }),
    ).rejects.toThrow(ThrottledError);
  });
});