import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { touched } from "@/db/touched";
import type { Actor } from "@/features/auth/server/actor";

export type FeedFilter = "comments" | "all";
export type SetFeedFilterResult = { status: "ok" } | { status: "invalid" };

function isFeedFilter(value: unknown): value is FeedFilter {
  return value === "comments" || value === "all";
}

export async function setFeedFilter(input: { actor: Actor; filter: unknown }): Promise<SetFeedFilterResult> {
  if (!isFeedFilter(input.filter)) {
    return { status: "invalid" };
  }

  await db
    .update(user)
    .set(touched({ feedFilter: input.filter }))
    .where(eq(user.id, input.actor.id));

  return { status: "ok" };
}

export async function getFeedFilter(userId: string): Promise<FeedFilter> {
  const [row] = await db.select({ feedFilter: user.feedFilter }).from(user).where(eq(user.id, userId));
  return row?.feedFilter === "comments" ? "comments" : "all";
}