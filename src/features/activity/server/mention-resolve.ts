import "server-only";
import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";

export const MENTION_TOKEN_PATTERN = /@\[([0-9a-f-]+)\]/g;

export async function resolveMentions(body: string): Promise<Map<string, string>> {
  const ids = Array.from(new Set(Array.from(body.matchAll(MENTION_TOKEN_PATTERN), (match) => match[1])));
  if (ids.length === 0) {
    return new Map();
  }

  const rows = await db
    .select({ id: user.id, firstName: user.firstName, lastName: user.lastName })
    .from(user)
    .where(inArray(user.id, ids));

  return new Map(rows.map((row) => [row.id, `${row.firstName} ${row.lastName}`]));
}