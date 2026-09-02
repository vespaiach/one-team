import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { authAttempt, credential, invite, resetToken, session, user } from "./schema";
import { testDb, truncateTestDatabase } from "./test-database";

beforeEach(async () => {
  await truncateTestDatabase();
});

async function insertUser(overrides: Partial<typeof user.$inferInsert> = {}) {
  const now = new Date();
  const [row] = await testDb
    .insert(user)
    .values({
      firstName: "Ada",
      lastName: "Lovelace",
      email: `ada-${crypto.randomUUID()}@example.com`,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning();
  if (!row) {
    throw new Error("insertUser produced no row");
  }
  return row;
}

describe("free-text CHECK bounds (FR-002, research C-2, C-3, C-4, C-11)", () => {
  describe("200-character names, handles, email and subject", () => {
    it("rejects a first_name over 200 characters", async () => {
      await expect(insertUser({ firstName: "a".repeat(201) })).rejects.toThrow();
    });

    it("accepts a first_name at exactly 200 characters", async () => {
      await expect(insertUser({ firstName: "a".repeat(200) })).resolves.toBeDefined();
    });

    it("rejects a last_name over 200 characters", async () => {
      await expect(insertUser({ lastName: "a".repeat(201) })).rejects.toThrow();
    });

    it("rejects an email over 200 characters", async () => {
      const overlong = `${"a".repeat(195)}@example.com`;
      expect(overlong.length).toBeGreaterThan(200);
      await expect(insertUser({ email: overlong })).rejects.toThrow();
    });

    it("rejects a job_title over 200 characters", async () => {
      await expect(insertUser({ jobTitle: "a".repeat(201) })).rejects.toThrow();
    });

    it("rejects a slack_handle over 200 characters", async () => {
      await expect(insertUser({ slackHandle: "a".repeat(201) })).rejects.toThrow();
    });

    it("rejects a phone over 200 characters", async () => {
      await expect(insertUser({ phone: "a".repeat(201) })).rejects.toThrow();
    });

    it("rejects an auth_attempt.subject over 200 characters", async () => {
      await expect(
        testDb.insert(authAttempt).values({
          flow: "signin",
          kind: "email",
          subject: "a".repeat(201),
          attemptedAt: new Date(),
        }),
      ).rejects.toThrow();
    });

    it("accepts an auth_attempt.subject at exactly 200 characters", async () => {
      await expect(
        testDb.insert(authAttempt).values({
          flow: "signin",
          kind: "email",
          subject: "a".repeat(200),
          attemptedAt: new Date(),
        }),
      ).resolves.toBeDefined();
    });
  });

  it("rejects a bio over 10000 characters", async () => {
    await expect(insertUser({ bio: "a".repeat(10001) })).rejects.toThrow();
  });

  it("accepts a bio at exactly 10000 characters", async () => {
    await expect(insertUser({ bio: "a".repeat(10000) })).resolves.toBeDefined();
  });

  it("rejects an avatar_url over 2000 characters", async () => {
    await expect(insertUser({ avatarUrl: "a".repeat(2001) })).rejects.toThrow();
  });

  it("accepts an avatar_url at exactly 2000 characters", async () => {
    await expect(insertUser({ avatarUrl: "a".repeat(2000) })).resolves.toBeDefined();
  });

  describe("credential.password_hash", () => {
    it("rejects a hash over 255 characters", async () => {
      const owner = await insertUser();
      const now = new Date();
      await expect(
        testDb.insert(credential).values({
          userId: owner.id,
          passwordHash: "a".repeat(256),
          createdAt: now,
          updatedAt: now,
        }),
      ).rejects.toThrow();
    });

    it("accepts a hash at exactly 255 characters", async () => {
      const owner = await insertUser();
      const now = new Date();
      await expect(
        testDb.insert(credential).values({
          userId: owner.id,
          passwordHash: "a".repeat(255),
          createdAt: now,
          updatedAt: now,
        }),
      ).resolves.toBeDefined();
    });
  });

  describe("session.ip_address and session.user_agent", () => {
    async function baseSession(overrides: Partial<typeof session.$inferInsert> = {}) {
      const owner = await insertUser();
      const now = new Date();
      return testDb.insert(session).values({
        userId: owner.id,
        tokenDigest: "a".repeat(64),
        createdAt: now,
        lastSeenAt: now,
        expiresAt: now,
        ipAddress: "127.0.0.1",
        ...overrides,
      });
    }

    it("rejects an ip_address over 45 characters", async () => {
      await expect(baseSession({ ipAddress: "1".repeat(46) })).rejects.toThrow();
    });

    it("accepts an ip_address at exactly 45 characters", async () => {
      await expect(baseSession({ ipAddress: "1".repeat(45) })).resolves.toBeDefined();
    });

    it("rejects a user_agent over 1000 characters", async () => {
      await expect(baseSession({ userAgent: "a".repeat(1001) })).rejects.toThrow();
    });

    it("accepts a user_agent at exactly 1000 characters", async () => {
      await expect(baseSession({ userAgent: "a".repeat(1000) })).resolves.toBeDefined();
    });
  });

  describe("token digests are bound to exactly 64 characters", () => {
    it("rejects a session.token_digest shorter than 64 characters", async () => {
      const owner = await insertUser();
      const now = new Date();
      await expect(
        testDb.insert(session).values({
          userId: owner.id,
          tokenDigest: "a".repeat(63),
          createdAt: now,
          lastSeenAt: now,
          expiresAt: now,
          ipAddress: "127.0.0.1",
        }),
      ).rejects.toThrow();
    });

    it("rejects a session.token_digest longer than 64 characters", async () => {
      const owner = await insertUser();
      const now = new Date();
      await expect(
        testDb.insert(session).values({
          userId: owner.id,
          tokenDigest: "a".repeat(65),
          createdAt: now,
          lastSeenAt: now,
          expiresAt: now,
          ipAddress: "127.0.0.1",
        }),
      ).rejects.toThrow();
    });

    it("rejects a reset_token.token_digest not exactly 64 characters", async () => {
      const owner = await insertUser();
      const now = new Date();
      await expect(
        testDb.insert(resetToken).values({
          userId: owner.id,
          tokenDigest: "a".repeat(63),
          expiresAt: now,
          createdAt: now,
        }),
      ).rejects.toThrow();
    });

    it("accepts a reset_token.token_digest at exactly 64 characters", async () => {
      const owner = await insertUser();
      const now = new Date();
      await expect(
        testDb.insert(resetToken).values({
          userId: owner.id,
          tokenDigest: "a".repeat(64),
          expiresAt: now,
          createdAt: now,
        }),
      ).resolves.toBeDefined();
    });

    describe("invite.token_digest", () => {
      it("rejects an invite.token_digest not exactly 64 characters", async () => {
        const admin = await insertUser();
        const now = new Date();
        await expect(
          testDb.insert(invite).values({
            email: `invitee-${crypto.randomUUID()}@example.com`,
            invitedBy: admin.id,
            tokenDigest: "a".repeat(63),
            expiresAt: now,
            createdAt: now,
            updatedAt: now,
          }),
        ).rejects.toThrow();
      });

      it("accepts an invite.token_digest at exactly 64 characters", async () => {
        const admin = await insertUser();
        const now = new Date();
        await expect(
          testDb.insert(invite).values({
            email: `invitee-${crypto.randomUUID()}@example.com`,
            invitedBy: admin.id,
            tokenDigest: "a".repeat(64),
            expiresAt: now,
            createdAt: now,
            updatedAt: now,
          }),
        ).resolves.toBeDefined();
      });
    });
  });
});

describe("invite enforced behaviour (FR-009a, FR-010)", () => {
  async function insertAdmin() {
    return insertUser();
  }

  function inviteValues(overrides: Partial<typeof invite.$inferInsert> & { invitedBy: string }) {
    const now = new Date();
    return {
      email: `invitee-${crypto.randomUUID()}@example.com`,
      tokenDigest: crypto.randomUUID().replace(/-/g, "").repeat(2),
      expiresAt: now,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }

  it("rejects a second unspent row for one case-folded address", async () => {
    const admin = await insertAdmin();
    const email = `Invitee-${crypto.randomUUID()}@Example.com`;
    await testDb.insert(invite).values(inviteValues({ invitedBy: admin.id, email }));

    await expect(
      testDb.insert(invite).values(inviteValues({ invitedBy: admin.id, email: email.toLowerCase() })),
    ).rejects.toThrow();
  });

  it("accepts a second row once the first is spent", async () => {
    const admin = await insertAdmin();
    const email = `invitee-${crypto.randomUUID()}@example.com`;
    const [first] = await testDb
      .insert(invite)
      .values(inviteValues({ invitedBy: admin.id, email }))
      .returning();
    if (!first) {
      throw new Error("first invite was not inserted");
    }
    await testDb.update(invite).set({ acceptedAt: new Date() }).where(eq(invite.id, first.id));

    await expect(
      testDb.insert(invite).values(inviteValues({ invitedBy: admin.id, email })),
    ).resolves.toBeDefined();
  });

  it("rejects an invite.email over 200 characters", async () => {
    const admin = await insertAdmin();
    const overlong = `${"a".repeat(195)}@example.com`;
    expect(overlong.length).toBeGreaterThan(200);
    await expect(
      testDb.insert(invite).values(inviteValues({ invitedBy: admin.id, email: overlong })),
    ).rejects.toThrow();
  });

  it("accepts an invite.email at exactly 200 characters", async () => {
    const admin = await insertAdmin();
    const email = `${"a".repeat(188)}@example.com`;
    expect(email.length).toBe(200);
    await expect(
      testDb.insert(invite).values(inviteValues({ invitedBy: admin.id, email })),
    ).resolves.toBeDefined();
  });
});