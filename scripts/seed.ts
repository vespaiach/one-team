import { pathToFileURL } from "node:url";
import nextEnv from "@next/env";
import { generateKeyBetween } from "fractional-indexing";
import { uuidv7 } from "uuidv7";
import {
  activity,
  boardColumn,
  comment,
  credential,
  issue,
  issueCounter,
  issueLabel,
  label,
  project,
  projectMember,
  user,
} from "../src/db/schema.ts";
import { truncateAllTablesStatement } from "../src/db/tables.ts";
import { hashPassword } from "../src/features/auth/server/crypto.ts";
import { SEED_COLUMNS } from "../src/features/projects/seed-columns.ts";
import {
  SEED_COMMENT_BODIES,
  SEED_ISSUE_DESCRIPTIONS,
  SEED_ISSUE_TITLES,
  SEED_LABELS,
  SEED_PROJECT_COMMENT_BODIES,
  SEED_PROJECTS,
  SEED_USERS,
  type SeedProject,
} from "./seed-data.ts";

nextEnv.loadEnvConfig(process.cwd());

export const SEED_PASSWORD = "one-team-demo-2026";

const RANDOM_SEED = 20260905;
const MINIMUM_PROJECT_MEMBERS = 3;
const MAXIMUM_PROJECT_MEMBERS = 7;
const MINIMUM_PROJECT_ISSUES = 6;
const MAXIMUM_PROJECT_ISSUES = 14;
const MAXIMUM_ISSUE_LABELS = 3;
const MAXIMUM_ISSUE_COMMENTS = 3;
const PRIORITIES = ["none", "low", "medium", "high", "urgent"] as const;
const HOUR_IN_MILLISECONDS = 60 * 60 * 1000;
const DAY_IN_MILLISECONDS = 24 * HOUR_IN_MILLISECONDS;

type DatabaseModule = typeof import("../src/db/index.ts");
type Database = DatabaseModule["db"];
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

type SeededUser = { id: string; fullName: string };
type SeededLabel = { id: string };

export type SeedSummary = {
  users: number;
  projects: number;
  memberships: number;
  columns: number;
  issues: number;
  labels: number;
  issueLabels: number;
  comments: number;
  activities: number;
};

function createRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function randomInteger(random: () => number, minimum: number, maximum: number): number {
  return minimum + Math.floor(random() * (maximum - minimum + 1));
}

function randomItem<T>(random: () => number, items: readonly T[]): T {
  const item = items[randomInteger(random, 0, items.length - 1)];
  if (item === undefined) {
    throw new Error("randomItem was given an empty list");
  }
  return item;
}

function randomSubset<T>(random: () => number, items: readonly T[], size: number): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapWith = randomInteger(random, 0, index);
    const current = shuffled[index];
    const other = shuffled[swapWith];
    if (current === undefined || other === undefined) {
      throw new Error("randomSubset produced an out-of-range index");
    }
    shuffled[index] = other;
    shuffled[swapWith] = current;
  }
  return shuffled.slice(0, size);
}

function shiftDate(isoDate: string, days: number): string {
  const shifted = new Date(`${isoDate}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

let databaseModulePromise: Promise<DatabaseModule> | null = null;

function loadDatabase(): Promise<DatabaseModule> {
  databaseModulePromise ??= import("../src/db/index.ts");
  return databaseModulePromise;
}

async function seedUsers(tx: Transaction, passwordHash: string, now: Date): Promise<SeededUser[]> {
  const rows = SEED_USERS.map((seedUser) => ({
    id: uuidv7(),
    firstName: seedUser.firstName,
    lastName: seedUser.lastName,
    email: seedUser.email,
    role: seedUser.role,
    jobTitle: seedUser.jobTitle,
    slackHandle: seedUser.slackHandle,
    phone: seedUser.phone,
    bio: seedUser.bio,
    mustChangePassword: false,
    createdAt: now,
    updatedAt: now,
  }));

  await tx.insert(user).values(rows);
  await tx
    .insert(credential)
    .values(rows.map((row) => ({ userId: row.id, passwordHash, createdAt: now, updatedAt: now })));

  return rows.map((row) => ({ id: row.id, fullName: `${row.firstName} ${row.lastName}` }));
}

async function seedLabels(tx: Transaction, now: Date): Promise<SeededLabel[]> {
  const rows = SEED_LABELS.map((name) => ({ id: uuidv7(), name, createdAt: now, updatedAt: now }));
  await tx.insert(label).values(rows);
  return rows.map((row) => ({ id: row.id }));
}

async function seedProject(
  tx: Transaction,
  spec: SeedProject,
  users: SeededUser[],
  labels: SeededLabel[],
  admin: SeededUser,
  random: () => number,
  now: Date,
): Promise<SeedSummary> {
  const projectId = uuidv7();
  const projectCreatedAt = new Date(now.getTime() - randomInteger(random, 60, 365) * DAY_IN_MILLISECONDS);

  await tx.insert(project).values({
    id: projectId,
    key: spec.key,
    name: spec.name,
    description: spec.description,
    status: spec.status,
    startDate: spec.startDate,
    targetDate: spec.targetDate,
    createdAt: projectCreatedAt,
    updatedAt: projectCreatedAt,
  });

  const columns = SEED_COLUMNS.map((column) => ({
    id: uuidv7(),
    projectId,
    name: column.name,
    kind: column.kind,
    sortOrder: column.sortOrder,
    createdAt: projectCreatedAt,
    updatedAt: projectCreatedAt,
  }));
  await tx.insert(boardColumn).values(columns);

  const firstColumn = columns[0];
  if (!firstColumn) {
    throw new Error("seedProject expected at least one board column");
  }

  const members = randomSubset(
    random,
    users,
    randomInteger(random, MINIMUM_PROJECT_MEMBERS, MAXIMUM_PROJECT_MEMBERS),
  );
  await tx.insert(projectMember).values(
    members.map((member) => ({
      projectId,
      userId: member.id,
      createdAt: projectCreatedAt,
      updatedAt: projectCreatedAt,
    })),
  );

  const issueCount = randomInteger(random, MINIMUM_PROJECT_ISSUES, MAXIMUM_PROJECT_ISSUES);
  await tx.insert(issueCounter).values({ projectId, lastNumber: issueCount });

  const activityRows: (typeof activity.$inferInsert)[] = [
    { actorId: admin.id, type: "created", projectId, createdAt: projectCreatedAt },
    ...members.map((member) => ({
      actorId: admin.id,
      type: "member_added" as const,
      projectId,
      toValue: member.fullName,
      createdAt: projectCreatedAt,
    })),
  ];

  const issueRows: (typeof issue.$inferInsert)[] = [];
  const issueLabelRows: (typeof issueLabel.$inferInsert)[] = [];
  const commentRows: (typeof comment.$inferInsert)[] = [];
  let previousSortOrder: string | null = null;

  for (let number = 1; number <= issueCount; number += 1) {
    const issueId = uuidv7();
    const ageInDays = randomInteger(random, 2, 60);
    const issueCreatedAt = new Date(now.getTime() - ageInDays * DAY_IN_MILLISECONDS);
    const author = randomItem(random, members);
    const column = randomItem(random, columns);
    const sortOrder = generateKeyBetween(previousSortOrder, null);
    previousSortOrder = sortOrder;

    issueRows.push({
      id: issueId,
      projectId,
      number,
      title: randomItem(random, SEED_ISSUE_TITLES),
      description: randomItem(random, SEED_ISSUE_DESCRIPTIONS),
      columnId: column.id,
      priority: randomItem(random, PRIORITIES),
      assigneeId: random() < 0.75 ? randomItem(random, members).id : null,
      dueDate: random() < 0.4 ? shiftDate(spec.startDate, randomInteger(random, 14, 240)) : null,
      createdBy: author.id,
      sortOrder,
      createdAt: issueCreatedAt,
      updatedAt: issueCreatedAt,
    });

    for (const attached of randomSubset(random, labels, randomInteger(random, 0, MAXIMUM_ISSUE_LABELS))) {
      issueLabelRows.push({ issueId, labelId: attached.id });
    }

    activityRows.push({
      actorId: author.id,
      type: "created",
      issueId,
      createdAt: issueCreatedAt,
    });

    if (column.id !== firstColumn.id) {
      activityRows.push({
        actorId: randomItem(random, members).id,
        type: "field_changed",
        issueId,
        field: "column",
        fromValue: firstColumn.name,
        toValue: column.name,
        createdAt: new Date(issueCreatedAt.getTime() + HOUR_IN_MILLISECONDS),
      });
    }

    for (let index = 0; index < randomInteger(random, 0, MAXIMUM_ISSUE_COMMENTS); index += 1) {
      const commentId = uuidv7();
      const commentAuthor = randomItem(random, members);
      const commentCreatedAt = new Date(
        issueCreatedAt.getTime() + randomInteger(random, 1, ageInDays * 24 - 1) * HOUR_IN_MILLISECONDS,
      );
      commentRows.push({
        id: commentId,
        authorId: commentAuthor.id,
        body: randomItem(random, SEED_COMMENT_BODIES),
        issueId,
        createdAt: commentCreatedAt,
        updatedAt: commentCreatedAt,
      });
      activityRows.push({
        actorId: commentAuthor.id,
        type: "comment",
        issueId,
        commentId,
        createdAt: commentCreatedAt,
      });
    }
  }

  for (const body of randomSubset(random, SEED_PROJECT_COMMENT_BODIES, randomInteger(random, 1, 2))) {
    const commentId = uuidv7();
    const commentAuthor = randomItem(random, members);
    const commentCreatedAt = new Date(
      projectCreatedAt.getTime() + randomInteger(random, 1, 24) * HOUR_IN_MILLISECONDS,
    );
    commentRows.push({
      id: commentId,
      authorId: commentAuthor.id,
      body,
      projectId,
      createdAt: commentCreatedAt,
      updatedAt: commentCreatedAt,
    });
    activityRows.push({
      actorId: commentAuthor.id,
      type: "comment",
      projectId,
      commentId,
      createdAt: commentCreatedAt,
    });
  }

  await tx.insert(issue).values(issueRows);
  if (issueLabelRows.length > 0) {
    await tx.insert(issueLabel).values(issueLabelRows);
  }
  await tx.insert(comment).values(commentRows);
  await tx.insert(activity).values(activityRows);

  return {
    users: 0,
    projects: 1,
    memberships: members.length,
    columns: columns.length,
    issues: issueRows.length,
    labels: 0,
    issueLabels: issueLabelRows.length,
    comments: commentRows.length,
    activities: activityRows.length,
  };
}

function addSummaries(left: SeedSummary, right: SeedSummary): SeedSummary {
  return {
    users: left.users + right.users,
    projects: left.projects + right.projects,
    memberships: left.memberships + right.memberships,
    columns: left.columns + right.columns,
    issues: left.issues + right.issues,
    labels: left.labels + right.labels,
    issueLabels: left.issueLabels + right.issueLabels,
    comments: left.comments + right.comments,
    activities: left.activities + right.activities,
  };
}

export async function runSeed(): Promise<SeedSummary> {
  const { db } = await loadDatabase();
  const passwordHash = await hashPassword(SEED_PASSWORD);
  const random = createRandom(RANDOM_SEED);
  const now = new Date();

  return db.transaction(async (tx) => {
    await tx.execute(truncateAllTablesStatement());

    const users = await seedUsers(tx, passwordHash, now);
    const labels = await seedLabels(tx, now);
    const admin = users[0];
    if (!admin) {
      throw new Error("runSeed expected at least one seeded user");
    }

    let summary: SeedSummary = {
      users: users.length,
      projects: 0,
      memberships: 0,
      columns: 0,
      issues: 0,
      labels: labels.length,
      issueLabels: 0,
      comments: 0,
      activities: 0,
    };

    for (const spec of SEED_PROJECTS) {
      summary = addSummaries(summary, await seedProject(tx, spec, users, labels, admin, random, now));
    }

    return summary;
  });
}

async function main(): Promise<void> {
  const summary = await runSeed();
  process.stdout.write(
    [
      "seeded:",
      `  users        ${summary.users}`,
      `  projects     ${summary.projects}`,
      `  memberships  ${summary.memberships}`,
      `  columns      ${summary.columns}`,
      `  issues       ${summary.issues}`,
      `  labels       ${summary.labels}`,
      `  issue labels ${summary.issueLabels}`,
      `  comments     ${summary.comments}`,
      `  activities   ${summary.activities}`,
      `every user signs in with the password ${SEED_PASSWORD}`,
      "",
    ].join("\n"),
  );

  const { client } = await loadDatabase();
  await client.end({ timeout: 0 });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}