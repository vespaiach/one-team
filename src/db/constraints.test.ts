import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import {
  authAttempt,
  boardColumn,
  credential,
  invite,
  issueCounter,
  project,
  projectMember,
  resetToken,
  session,
  user,
} from "./schema";
import { testDb, testSql, truncateTestDatabase } from "./test-database";

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

async function insertProject(overrides: Partial<typeof project.$inferInsert> = {}) {
  const now = new Date();
  const [row] = await testDb
    .insert(project)
    .values({
      key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      name: "Website Redesign",
      createdAt: now,
      updatedAt: now,
      ...overrides,
    })
    .returning();
  if (!row) {
    throw new Error("insertProject produced no row");
  }
  return row;
}

describe("project constraints (FR-002, FR-003, FR-012, FR-028, data-model §1)", () => {
  describe("key pattern", () => {
    it("rejects a key that does not match ^[A-Z][A-Z0-9]{0,7}$", async () => {
      await expect(insertProject({ key: "wr" })).rejects.toThrow();
    });

    it("rejects a key starting with a digit", async () => {
      await expect(insertProject({ key: "1AB" })).rejects.toThrow();
    });

    it("accepts a key that matches the pattern", async () => {
      await expect(insertProject({ key: "WR" })).resolves.toBeDefined();
    });
  });

  describe("UNIQUE (key)", () => {
    it("rejects a second project with the same key", async () => {
      await insertProject({ key: "DUP" });

      await expect(insertProject({ key: "DUP" })).rejects.toThrow();
    });
  });

  describe("status CHECK", () => {
    it("rejects a status outside active or archived", async () => {
      await expect(insertProject({ status: "deleted" })).rejects.toThrow();
    });

    it.each(["active", "archived"])("accepts status %s", async (status) => {
      await expect(insertProject({ status })).resolves.toBeDefined();
    });
  });

  describe("project_dates_ordered CHECK", () => {
    it("rejects a target date before the start date", async () => {
      await expect(insertProject({ startDate: "2026-06-10", targetDate: "2026-06-01" })).rejects.toThrow();
    });

    it("accepts a target date equal to the start date", async () => {
      await expect(
        insertProject({ startDate: "2026-06-10", targetDate: "2026-06-10" }),
      ).resolves.toBeDefined();
    });

    it("accepts a target date after the start date", async () => {
      await expect(
        insertProject({ startDate: "2026-06-10", targetDate: "2026-06-20" }),
      ).resolves.toBeDefined();
    });

    it("accepts either date left null", async () => {
      await expect(insertProject({ startDate: "2026-06-10", targetDate: null })).resolves.toBeDefined();
      await expect(insertProject({ startDate: null, targetDate: "2026-06-01" })).resolves.toBeDefined();
    });
  });

  describe("200/10 000 character bounds", () => {
    it("rejects a name over 200 characters", async () => {
      await expect(insertProject({ name: "a".repeat(201) })).rejects.toThrow();
    });

    it("accepts a name at exactly 200 characters", async () => {
      await expect(insertProject({ name: "a".repeat(200) })).resolves.toBeDefined();
    });

    it("rejects a description over 10000 characters", async () => {
      await expect(insertProject({ description: "a".repeat(10001) })).rejects.toThrow();
    });

    it("accepts a description at exactly 10000 characters", async () => {
      await expect(insertProject({ description: "a".repeat(10000) })).resolves.toBeDefined();
    });
  });
});

describe("project_member composite primary key and cascade (FR-005, data-model §2)", () => {
  it("refuses a duplicate (project_id, user_id) pair", async () => {
    const proj = await insertProject();
    const member = await insertUser();
    const now = new Date();
    await testDb
      .insert(projectMember)
      .values({ projectId: proj.id, userId: member.id, createdAt: now, updatedAt: now });

    await expect(
      testDb
        .insert(projectMember)
        .values({ projectId: proj.id, userId: member.id, createdAt: now, updatedAt: now }),
    ).rejects.toThrow();
  });

  it("disappears when its project is deleted", async () => {
    const proj = await insertProject();
    const member = await insertUser();
    const now = new Date();
    await testDb
      .insert(projectMember)
      .values({ projectId: proj.id, userId: member.id, createdAt: now, updatedAt: now });

    await testDb.delete(project).where(eq(project.id, proj.id));

    const remaining = await testDb.select().from(projectMember).where(eq(projectMember.userId, member.id));
    expect(remaining).toHaveLength(0);
  });
});

describe("board_column uniqueness, kind CHECK and cascade (FR-006, data-model §3)", () => {
  async function insertColumn(overrides: Partial<typeof boardColumn.$inferInsert> & { projectId: string }) {
    const now = new Date();
    return testDb.insert(boardColumn).values({
      name: "Backlog",
      sortOrder: "a0",
      kind: "open",
      createdAt: now,
      updatedAt: now,
      ...overrides,
    });
  }

  describe("UNIQUE (project_id, lower(name))", () => {
    it("refuses a case-varied duplicate name within one project", async () => {
      const proj = await insertProject();
      await insertColumn({ projectId: proj.id, name: "Backlog" });

      await expect(insertColumn({ projectId: proj.id, name: "BACKLOG", sortOrder: "a1" })).rejects.toThrow();
    });

    it("allows the same name in two different projects", async () => {
      const first = await insertProject();
      const second = await insertProject();
      await insertColumn({ projectId: first.id, name: "Backlog" });

      await expect(insertColumn({ projectId: second.id, name: "Backlog" })).resolves.toBeDefined();
    });
  });

  describe("kind CHECK", () => {
    it("rejects a kind outside open, done or canceled", async () => {
      const proj = await insertProject();
      await expect(insertColumn({ projectId: proj.id, kind: "bogus" })).rejects.toThrow();
    });

    it.each(["open", "done", "canceled"])("accepts kind %s", async (kind) => {
      const proj = await insertProject();
      await expect(insertColumn({ projectId: proj.id, kind })).resolves.toBeDefined();
    });
  });

  it("is deleted when its project is deleted", async () => {
    const proj = await insertProject();
    await insertColumn({ projectId: proj.id });

    await testDb.delete(project).where(eq(project.id, proj.id));

    const remaining = await testDb.select().from(boardColumn).where(eq(boardColumn.projectId, proj.id));
    expect(remaining).toHaveLength(0);
  });
});

describe("issue_counter uniqueness, shape and cascade (FR-008, SC-017, data-model §4)", () => {
  it("refuses a second row for one project", async () => {
    const proj = await insertProject();
    await testDb.insert(issueCounter).values({ projectId: proj.id, lastNumber: 0 });

    await expect(testDb.insert(issueCounter).values({ projectId: proj.id, lastNumber: 0 })).rejects.toThrow();
  });

  it("refuses a second row under two concurrent inserts", async () => {
    const proj = await insertProject();

    const results = await Promise.allSettled([
      testDb.insert(issueCounter).values({ projectId: proj.id, lastNumber: 0 }),
      testDb.insert(issueCounter).values({ projectId: proj.id, lastNumber: 0 }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
  });

  it("carries no created_at or updated_at columns", async () => {
    const columns = await testSql<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'issue_counter'
    `;
    const names = columns.map((column) => column.column_name);
    expect(names).not.toContain("created_at");
    expect(names).not.toContain("updated_at");
  });

  it("is deleted when its project is deleted", async () => {
    const proj = await insertProject();
    await testDb.insert(issueCounter).values({ projectId: proj.id, lastNumber: 0 });

    await testDb.delete(project).where(eq(project.id, proj.id));

    const remaining = await testDb.select().from(issueCounter).where(eq(issueCounter.projectId, proj.id));
    expect(remaining).toHaveLength(0);
  });
});