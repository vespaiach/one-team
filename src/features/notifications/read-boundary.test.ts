import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { eq } from "drizzle-orm";
import { uuidv7 } from "uuidv7";
import { beforeEach, describe, expect, it } from "vitest";
import { boardColumn, issue, notification, project, user } from "@/db/schema";
import { testDb, truncateTestDatabase } from "@/db/test-database";
import { markNotificationRead } from "./server/mark-read";
import { listNotifications } from "./server/notification-queries";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const FEATURE_DIR = join(REPO_ROOT, "src", "features", "notifications");
const CLIENT_REACHABLE = [join(FEATURE_DIR, "actions.ts"), join(FEATURE_DIR, "components")] as const;

const LIST_ITEM_KEYS = ["actorName", "createdAt", "href", "id", "isUnread", "targetLabel", "type"];

const RECIPIENT_EMAIL_PATTERN = /user\.email/;
const DELIVERY_STATE_PATTERN = /sendAttempts|emailedAt/;

const R1_PROJECTIONS = `import "server-only";
import { user } from "@/db/schema";

export const publicUser = {
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  avatarUrl: user.avatarUrl,
  role: user.role,
  jobTitle: user.jobTitle,
  deactivatedAt: user.deactivatedAt,
};

export const accountUser = {
  ...publicUser,
  email: user.email,
  slackHandle: user.slackHandle,
  phone: user.phone,
  bio: user.bio,
};`;

function sourceFilesUnder(target: string): string[] {
  return readdirSync(target, { recursive: true })
    .map((entry) => join(target, String(entry)))
    .filter((file) => file.endsWith(".ts") || file.endsWith(".tsx"))
    .filter((file) => !file.endsWith(".test.ts") && !file.endsWith(".test.tsx"));
}

function filesMatching(targets: readonly string[], pattern: RegExp): string[] {
  return targets
    .flatMap((target) => (target.endsWith(".ts") ? [target] : sourceFilesUnder(target)))
    .filter((file) => pattern.test(readFileSync(file, "utf8")))
    .map((file) => relative(REPO_ROOT, file));
}

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

async function insertIssueRow(createdBy: string) {
  const now = new Date();
  const [projectRow] = await testDb
    .insert(project)
    .values({
      key: `P${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`,
      name: "Website Redesign",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!projectRow) {
    throw new Error("insertIssueRow produced no project");
  }
  const [columnRow] = await testDb
    .insert(boardColumn)
    .values({
      projectId: projectRow.id,
      name: "Backlog",
      kind: "open",
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!columnRow) {
    throw new Error("insertIssueRow produced no column");
  }
  const [row] = await testDb
    .insert(issue)
    .values({
      projectId: projectRow.id,
      number: 142,
      title: "Fix the header",
      columnId: columnRow.id,
      createdBy,
      sortOrder: "a0",
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!row) {
    throw new Error("insertIssueRow produced no row");
  }
  return row;
}

async function insertNotification(values: { userId: string; actorId: string; issueId: string }) {
  const now = new Date();
  const [row] = await testDb
    .insert(notification)
    .values({ type: "assignment", createdAt: now, updatedAt: now, ...values })
    .returning();
  if (!row) {
    throw new Error("insertNotification produced no row");
  }
  return row;
}

beforeEach(async () => {
  await truncateTestDatabase();
});

describe("NotificationListItem carries exactly the seven keys the data model lists (FR-073, SC-002)", () => {
  it("returns no sendAttempts, emailedAt, readAt or email alongside them", async () => {
    const recipient = await insertUser();
    const actor = await insertUser({ firstName: "Alan", lastName: "Turing" });
    const issueRow = await insertIssueRow(actor.id);
    await insertNotification({
      userId: recipient.id,
      actorId: actor.id,
      issueId: issueRow.id,
    });

    const [item] = await listNotifications(recipient.id);

    expect(item).toBeDefined();
    expect(Object.keys(item ?? {}).sort()).toEqual(LIST_ITEM_KEYS);
  });
});

describe("the recipient's address is read by one server module and returned by none (FR-073)", () => {
  it("selects user.email nowhere but the mail module", () => {
    expect(filesMatching([FEATURE_DIR], RECIPIENT_EMAIL_PATTERN)).toEqual([
      "src/features/notifications/server/mail.ts",
    ]);
  });

  it("names no delivery state in the action module or any component (FR-007)", () => {
    expect(filesMatching(CLIENT_REACHABLE, DELIVERY_STATE_PATTERN)).toEqual([]);
  });

  it("recognises a selection and a delivery-state read when one is written", () => {
    expect(RECIPIENT_EMAIL_PATTERN.test("recipientEmail: user.email,")).toBe(true);
    expect(DELIVERY_STATE_PATTERN.test("sendAttempts: notification.sendAttempts,")).toBe(true);
  });

  it("leaves publicUser and accountUser byte-for-byte what R1 delivered", () => {
    const projections = readFileSync(
      join(REPO_ROOT, "src", "features", "auth", "server", "projections.ts"),
      "utf8",
    );

    expect(projections).toBe(R1_PROJECTIONS);
  });
});

describe("a row the caller does not hold is indistinguishable from no row at all (FR-026, SC-002)", () => {
  it("answers a foreign row exactly as it answers an id naming nothing, and changes neither", async () => {
    const recipient = await insertUser();
    const stranger = await insertUser({ firstName: "Grace", lastName: "Hopper" });
    const actor = await insertUser({ firstName: "Alan", lastName: "Turing" });
    const issueRow = await insertIssueRow(actor.id);
    const foreign = await insertNotification({
      userId: stranger.id,
      actorId: actor.id,
      issueId: issueRow.id,
    });

    const foreignOutcome = await markNotificationRead({
      userId: recipient.id,
      notificationId: foreign.id,
    });
    const unknownOutcome = await markNotificationRead({
      userId: recipient.id,
      notificationId: uuidv7(),
    });

    expect(foreignOutcome).toBe(unknownOutcome);
    const [row] = await testDb.select().from(notification).where(eq(notification.id, foreign.id));
    expect(row?.readAt).toBeNull();
    expect(row?.updatedAt.toISOString()).toBe(foreign.updatedAt.toISOString());
  });

  it("offers no parameter through which a foreign identifier could reach the clear-all action (FR-024)", async () => {
    const { markAllNotificationsRead } = await import("./actions");

    expect(markAllNotificationsRead.length).toBe(0);
  });
});