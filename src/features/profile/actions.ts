"use server";

import { sql } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { db } from "@/db";
import { user } from "@/db/schema";
import { touched } from "@/db/touched";
import { requireActor } from "@/features/auth/server/actor";
import { assertSameOrigin } from "@/features/auth/server/origin";
import { PROFILE_FIELDS, type ProfileField } from "./fields";
import { parseAvatarField, parseOptionalField, parseRequiredField } from "./server/input";

export type ProfileRefusalReason = "required" | "too_long" | "avatar_scheme" | "unknown_field" | "generic";

export type UpdateOwnProfileResult =
  | { status: "accepted" }
  | { status: "unchanged" }
  | { status: "refused"; reason: ProfileRefusalReason };

const PROFILE_FIELD_NAMES: Set<string> = new Set(PROFILE_FIELDS.map((definition) => definition.field));
const BOUNDS = Object.fromEntries(
  PROFILE_FIELDS.map((definition) => [definition.field, definition.bound]),
) as Record<ProfileField, number>;

function isProfileField(field: string): field is ProfileField {
  return PROFILE_FIELD_NAMES.has(field);
}

async function writeColumn(
  actorId: string,
  column: PgColumn,
  setValues: Partial<typeof user.$inferInsert>,
  value: string | null,
): Promise<UpdateOwnProfileResult> {
  const [row] = await db
    .update(user)
    .set(touched(setValues))
    .where(sql`${user.id} = ${actorId} and ${column} is distinct from ${value}`)
    .returning({ id: user.id });

  if (!row) {
    return { status: "unchanged" };
  }
  revalidatePath("/profile");
  return { status: "accepted" };
}

export async function updateOwnProfile(field: string, value: unknown): Promise<UpdateOwnProfileResult> {
  assertSameOrigin({ headers: await headers() });
  const actor = await requireActor();

  if (!isProfileField(field)) {
    return { status: "refused", reason: "unknown_field" };
  }

  switch (field) {
    case "firstName": {
      const parsed = parseRequiredField(value, BOUNDS.firstName);
      if (!parsed.ok) {
        return { status: "refused", reason: parsed.reason };
      }
      return writeColumn(actor.id, user.firstName, { firstName: parsed.value }, parsed.value);
    }
    case "lastName": {
      const parsed = parseRequiredField(value, BOUNDS.lastName);
      if (!parsed.ok) {
        return { status: "refused", reason: parsed.reason };
      }
      return writeColumn(actor.id, user.lastName, { lastName: parsed.value }, parsed.value);
    }
    case "avatarUrl": {
      const parsed = parseAvatarField(value, BOUNDS.avatarUrl);
      if (!parsed.ok) {
        return { status: "refused", reason: parsed.reason };
      }
      return writeColumn(actor.id, user.avatarUrl, { avatarUrl: parsed.value }, parsed.value);
    }
    case "jobTitle": {
      const parsed = parseOptionalField(value, BOUNDS.jobTitle);
      if (!parsed.ok) {
        return { status: "refused", reason: parsed.reason };
      }
      return writeColumn(actor.id, user.jobTitle, { jobTitle: parsed.value }, parsed.value);
    }
    case "slackHandle": {
      const parsed = parseOptionalField(value, BOUNDS.slackHandle);
      if (!parsed.ok) {
        return { status: "refused", reason: parsed.reason };
      }
      return writeColumn(actor.id, user.slackHandle, { slackHandle: parsed.value }, parsed.value);
    }
    case "phone": {
      const parsed = parseOptionalField(value, BOUNDS.phone);
      if (!parsed.ok) {
        return { status: "refused", reason: parsed.reason };
      }
      return writeColumn(actor.id, user.phone, { phone: parsed.value }, parsed.value);
    }
    case "bio": {
      const parsed = parseOptionalField(value, BOUNDS.bio);
      if (!parsed.ok) {
        return { status: "refused", reason: parsed.reason };
      }
      return writeColumn(actor.id, user.bio, { bio: parsed.value }, parsed.value);
    }
  }
}