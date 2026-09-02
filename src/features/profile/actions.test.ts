import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { issueSession, SESSION_COOKIE_NAME } from "@/features/auth/server/sessions";
import { updateOwnProfile } from "./actions";

const ORIGINAL_APP_URL = process.env.APP_URL;

let currentOrigin: string | undefined = "https://app.example.com";
const cookieJar = new Map<string, string>();

const revalidatePath = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (path: string) => revalidatePath(path),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(currentOrigin ? { origin: currentOrigin } : {}),
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { value: cookieJar.get(name) } : undefined),
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

beforeEach(async () => {
  await truncateTestDatabase();
  process.env.APP_URL = "https://app.example.com";
  currentOrigin = "https://app.example.com";
  cookieJar.clear();
  revalidatePath.mockClear();
});

afterEach(() => {
  process.env.APP_URL = ORIGINAL_APP_URL;
  vi.restoreAllMocks();
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

async function signInAs(userId: string) {
  const { token } = await issueSession({ userId, ipAddress: "203.0.113.4", userAgent: null });
  cookieJar.set(SESSION_COOKIE_NAME, token);
}

async function currentRow(userId: string) {
  const [row] = await testDb.select().from(user).where(eq(user.id, userId));
  if (!row) {
    throw new Error("row vanished");
  }
  return row;
}

describe("updateOwnProfile — order of operations (contract steps 1-2)", () => {
  it("refuses a request whose Origin does not match APP_URL, before reading or writing anything", async () => {
    const owner = await insertUser();
    await signInAs(owner.id);
    currentOrigin = "https://evil.example.com";

    await expect(updateOwnProfile("jobTitle", "Engineer")).rejects.toThrow();

    const row = await currentRow(owner.id);
    expect(row.jobTitle).toBeNull();
  });

  it("redirects to sign-in and writes nothing for a caller with no resolvable session", async () => {
    await expect(updateOwnProfile("jobTitle", "Engineer")).rejects.toThrow("NEXT_REDIRECT:/signin");
  });
});

describe("updateOwnProfile — each of the seven writes its own column and no other (FR-021)", () => {
  it("writes firstName alone", async () => {
    const owner = await insertUser();
    await signInAs(owner.id);

    const result = await updateOwnProfile("firstName", "Grace");

    expect(result).toEqual({ status: "accepted" });
    const row = await currentRow(owner.id);
    expect(row.firstName).toBe("Grace");
    expect(row.lastName).toBe("Lovelace");
  });

  it("writes lastName alone", async () => {
    const owner = await insertUser();
    await signInAs(owner.id);

    const result = await updateOwnProfile("lastName", "Hopper");

    expect(result).toEqual({ status: "accepted" });
    const row = await currentRow(owner.id);
    expect(row.lastName).toBe("Hopper");
    expect(row.firstName).toBe("Ada");
  });

  it("writes avatarUrl alone", async () => {
    const owner = await insertUser();
    await signInAs(owner.id);

    const result = await updateOwnProfile("avatarUrl", "https://example.com/a.png");

    expect(result).toEqual({ status: "accepted" });
    const row = await currentRow(owner.id);
    expect(row.avatarUrl).toBe("https://example.com/a.png");
  });

  it("writes jobTitle alone", async () => {
    const owner = await insertUser();
    await signInAs(owner.id);

    const result = await updateOwnProfile("jobTitle", "Engineer");

    expect(result).toEqual({ status: "accepted" });
    const row = await currentRow(owner.id);
    expect(row.jobTitle).toBe("Engineer");
  });

  it("writes slackHandle alone", async () => {
    const owner = await insertUser();
    await signInAs(owner.id);

    const result = await updateOwnProfile("slackHandle", "@ada");

    expect(result).toEqual({ status: "accepted" });
    const row = await currentRow(owner.id);
    expect(row.slackHandle).toBe("@ada");
  });

  it("writes phone alone", async () => {
    const owner = await insertUser();
    await signInAs(owner.id);

    const result = await updateOwnProfile("phone", "+44 7700 900000");

    expect(result).toEqual({ status: "accepted" });
    const row = await currentRow(owner.id);
    expect(row.phone).toBe("+44 7700 900000");
  });

  it("writes bio alone", async () => {
    const owner = await insertUser();
    await signInAs(owner.id);

    const result = await updateOwnProfile("bio", "Line one\nLine two");

    expect(result).toEqual({ status: "accepted" });
    const row = await currentRow(owner.id);
    expect(row.bio).toBe("Line one\nLine two");
  });
});

describe("updateOwnProfile — required fields (FR-007)", () => {
  it("refuses an empty first name and writes nothing", async () => {
    const owner = await insertUser();
    await signInAs(owner.id);

    const result = await updateOwnProfile("firstName", "   ");

    expect(result).toEqual({ status: "refused", reason: "required" });
    const row = await currentRow(owner.id);
    expect(row.firstName).toBe("Ada");
  });

  it("refuses an empty last name and writes nothing", async () => {
    const owner = await insertUser();
    await signInAs(owner.id);

    const result = await updateOwnProfile("lastName", "");

    expect(result).toEqual({ status: "refused", reason: "required" });
  });
});

describe("updateOwnProfile — clearing an optional field (FR-012a)", () => {
  it("stores NULL rather than an empty string when an optional field is cleared", async () => {
    const owner = await insertUser({ jobTitle: "Engineer" });
    await signInAs(owner.id);

    const result = await updateOwnProfile("jobTitle", "");

    expect(result).toEqual({ status: "accepted" });
    const row = await currentRow(owner.id);
    expect(row.jobTitle).toBeNull();
  });

  it("clears the avatar without measuring it against the scheme rule", async () => {
    const owner = await insertUser({ avatarUrl: "https://example.com/a.png" });
    await signInAs(owner.id);

    const result = await updateOwnProfile("avatarUrl", "   ");

    expect(result).toEqual({ status: "accepted" });
    const row = await currentRow(owner.id);
    expect(row.avatarUrl).toBeNull();
  });
});

describe("updateOwnProfile — bounds (FR-020)", () => {
  it("saves a job title at exactly its bound and refuses one character beyond it", async () => {
    const owner = await insertUser();
    await signInAs(owner.id);

    const atBound = await updateOwnProfile("jobTitle", "a".repeat(200));
    expect(atBound).toEqual({ status: "accepted" });

    const overBound = await updateOwnProfile("jobTitle", "a".repeat(201));
    expect(overBound).toEqual({ status: "refused", reason: "too_long" });

    const row = await currentRow(owner.id);
    expect(row.jobTitle).toBe("a".repeat(200));
  });

  it("saves a bio of bound-many astral characters, counted in code points", async () => {
    const owner = await insertUser();
    await signInAs(owner.id);

    const result = await updateOwnProfile("bio", "😀".repeat(10000));

    expect(result).toEqual({ status: "accepted" });
  });
});

describe("updateOwnProfile — the avatar scheme, called directly (FR-011, SC-010)", () => {
  it("accepts an uppercase HTTPS scheme", async () => {
    const owner = await insertUser();
    await signInAs(owner.id);

    const result = await updateOwnProfile("avatarUrl", "HTTPS://example.com/a.png");

    expect(result).toEqual({ status: "accepted" });
  });

  it("refuses a javascript scheme before storage, whether or not the screen would allow it", async () => {
    const owner = await insertUser();
    await signInAs(owner.id);

    const result = await updateOwnProfile("avatarUrl", "javascript:alert(1)");

    expect(result).toEqual({ status: "refused", reason: "avatar_scheme" });
    const row = await currentRow(owner.id);
    expect(row.avatarUrl).toBeNull();
  });
});

describe("updateOwnProfile — unchanged values write nothing (FR-016)", () => {
  it("returns unchanged and does not move updated_at for an identical value", async () => {
    const owner = await insertUser({ jobTitle: "Engineer" });
    await signInAs(owner.id);
    const before = await currentRow(owner.id);

    const result = await updateOwnProfile("jobTitle", "Engineer");

    expect(result).toEqual({ status: "unchanged" });
    const after = await currentRow(owner.id);
    expect(after.updatedAt).toEqual(before.updatedAt);
  });

  it("moves updated_at only for an accepted write", async () => {
    const owner = await insertUser({ jobTitle: "Engineer" });
    await signInAs(owner.id);
    const before = await currentRow(owner.id);
    await new Promise((resolve) => setTimeout(resolve, 5));

    const result = await updateOwnProfile("jobTitle", "Staff Engineer");

    expect(result).toEqual({ status: "accepted" });
    const after = await currentRow(owner.id);
    expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
  });
});

describe("updateOwnProfile — last write wins across two of the caller's own sessions", () => {
  it("a differing second save from another session replaces the first", async () => {
    const owner = await insertUser();
    await signInAs(owner.id);

    await updateOwnProfile("jobTitle", "Engineer");
    await signInAs(owner.id);
    const second = await updateOwnProfile("jobTitle", "Staff Engineer");

    expect(second).toEqual({ status: "accepted" });
    const row = await currentRow(owner.id);
    expect(row.jobTitle).toBe("Staff Engineer");
  });

  it("a matching second save from another session returns unchanged and moves nothing", async () => {
    const owner = await insertUser();
    await signInAs(owner.id);
    await updateOwnProfile("jobTitle", "Engineer");
    const before = await currentRow(owner.id);

    await signInAs(owner.id);
    const second = await updateOwnProfile("jobTitle", "Engineer");

    expect(second).toEqual({ status: "unchanged" });
    const after = await currentRow(owner.id);
    expect(after.updatedAt).toEqual(before.updatedAt);
  });
});

describe("updateOwnProfile — self only, no user identifier admitted (FR-018, FR-019, OT-AUTHZ-001, OT-AUTHZ-004)", () => {
  it("touches only the caller's own row; a second user's row is untouched", async () => {
    const owner = await insertUser({ jobTitle: "Engineer" });
    const other = await insertUser({ jobTitle: "Original" });
    await signInAs(owner.id);

    await updateOwnProfile("jobTitle", "Staff Engineer");

    const ownerRow = await currentRow(owner.id);
    const otherRow = await currentRow(other.id);
    expect(ownerRow.jobTitle).toBe("Staff Engineer");
    expect(otherRow.jobTitle).toBe("Original");
  });

  it("admits no user-identifying argument in its signature", () => {
    expect(updateOwnProfile.length).toBe(2);
  });
});

describe("updateOwnProfile — never writes role, email, must_change_password or feed_filter (FR-021, FR-025)", () => {
  it("leaves every non-profile column untouched across all seven writes", async () => {
    const owner = await insertUser({ role: "admin", mustChangePassword: true, feedFilter: "comments" });
    await signInAs(owner.id);

    await updateOwnProfile("avatarUrl", "https://example.com/a.png");
    await updateOwnProfile("firstName", "New");
    await updateOwnProfile("lastName", "Name");
    await updateOwnProfile("jobTitle", "Engineer");
    await updateOwnProfile("slackHandle", "@new");
    await updateOwnProfile("phone", "+1 555 0100");
    await updateOwnProfile("bio", "hello");

    const row = await currentRow(owner.id);
    expect(row.role).toBe("admin");
    expect(row.email).toBe(owner.email);
    expect(row.mustChangePassword).toBe(true);
    expect(row.feedFilter).toBe("comments");
  });
});

describe("updateOwnProfile — unknown field (FR-021)", () => {
  it("refuses a field outside the seven and writes nothing", async () => {
    const owner = await insertUser();
    await signInAs(owner.id);

    const result = await updateOwnProfile("role", "admin");

    expect(result).toEqual({ status: "refused", reason: "unknown_field" });
    const row = await currentRow(owner.id);
    expect(row.role).toBe("member");
  });
});

describe("updateOwnProfile — revalidation (B-4)", () => {
  it("revalidates /profile on an accepted write and never on a refusal", async () => {
    const owner = await insertUser();
    await signInAs(owner.id);

    await updateOwnProfile("jobTitle", "Engineer");
    expect(revalidatePath).toHaveBeenCalledWith("/profile");

    revalidatePath.mockClear();
    await updateOwnProfile("firstName", "   ");
    expect(revalidatePath).not.toHaveBeenCalled();

    revalidatePath.mockClear();
    await updateOwnProfile("jobTitle", "Engineer");
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("updateOwnProfile — never throws for an expected failure (B-2)", () => {
  it("returns a typed refusal rather than throwing for a bad avatar scheme", async () => {
    const owner = await insertUser();
    await signInAs(owner.id);

    await expect(updateOwnProfile("avatarUrl", "javascript:alert(1)")).resolves.toEqual({
      status: "refused",
      reason: "avatar_scheme",
    });
  });
});