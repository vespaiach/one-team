import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { activity, comment, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { addProjectMember } from "@/features/projects/server/membership";
import { resolveMentions } from "./mention-resolve";

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

describe("a frozen activity value stays frozen; a mention stays live — both after the same rename (FR-007, FR-022, SC-005, SC-006)", () => {
  it("keeps a written member_added row's to_value exactly as written after the member is renamed", async () => {
    const proj = await insertProject();
    const admin = await insertUser({ role: "admin" });
    const member = await insertUser({ firstName: "Ada", lastName: "Lovelace" });

    await addProjectMember(proj.id, member.id, admin.id);

    await testDb.update(user).set({ firstName: "Augusta", lastName: "King" }).where(eq(user.id, member.id));

    const rows = await testDb.select().from(activity).where(eq(activity.projectId, proj.id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.toValue).toBe("Ada Lovelace");
  });

  it("resolves a comment's mention to the current display name after the mentioned user is renamed", async () => {
    const proj = await insertProject();
    const author = await insertUser({ firstName: "Grace", lastName: "Hopper" });
    const mentioned = await insertUser({ firstName: "Ada", lastName: "Lovelace" });
    const now = new Date();
    const [commentRow] = await testDb
      .insert(comment)
      .values({
        authorId: author.id,
        projectId: proj.id,
        body: `Hey @[${mentioned.id}], can you take a look?`,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!commentRow) {
      throw new Error("setup: comment not inserted");
    }

    await testDb
      .update(user)
      .set({ firstName: "Augusta", lastName: "King" })
      .where(eq(user.id, mentioned.id));

    const names = await resolveMentions(commentRow.body);
    expect(names.get(mentioned.id)).toBe("Augusta King");
  });
});