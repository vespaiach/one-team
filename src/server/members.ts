import { and, eq, sql } from "drizzle-orm";
import type { Database } from "./db.ts";
import { isValidEmail } from "./emailAddress.ts";
import { members } from "./schema.ts";

export type Member = {
  id: number;
  fullName: string;
  username: string;
  role: "admin" | "member";
};

type ProfileInput = {
  email: string;
  fullName: string;
  username: string;
};

type ProfileFields = Partial<Record<"full name" | "username" | "email", string>>;

type CreateFirstAdminResult =
  | { ok: true; member: Member }
  | { ok: false; fields: ProfileFields }
  | { ok: false; error: "Setup already done" };

function validateProfile(
  input: ProfileInput,
): { ok: true; profile: ProfileInput } | { ok: false; fields: ProfileFields } {
  const email = input.email.trim();
  const fullName = input.fullName.trim();
  const username = input.username.toLowerCase();
  const fields: ProfileFields = {};
  if (fullName === "") {
    fields["full name"] = "Name required";
  } else if (fullName.length > 60) {
    fields["full name"] = "Too long (max 60)";
  }
  if (!/^[a-z0-9-]{2,20}$/.test(username)) {
    fields.username = "2 to 20 lowercase letters, digits or hyphens";
  }
  if (!isValidEmail(email)) {
    fields.email = "Enter a valid email address.";
  }
  if (Object.keys(fields).length > 0) {
    return { ok: false, fields };
  }
  return { ok: true, profile: { email, fullName, username } };
}

export const memberColumns = {
  id: members.id,
  fullName: members.fullName,
  username: members.username,
  role: members.role,
};

export async function createFirstAdmin(db: Database, input: ProfileInput): Promise<CreateFirstAdminResult> {
  const validated = validateProfile(input);
  if (!validated.ok) {
    return validated;
  }
  const { email, fullName, username } = validated.profile;
  return db.transaction(async (tx): Promise<CreateFirstAdminResult> => {
    await tx.execute(sql`lock table ${members} in share row exclusive mode`);
    const existing = await tx.select({ id: members.id }).from(members).limit(1);
    if (existing.length > 0) {
      return { ok: false, error: "Setup already done" };
    }
    const [member] = await tx
      .insert(members)
      .values({ email, fullName, username, role: "admin" })
      .returning(memberColumns);
    return { ok: true, member };
  });
}

export async function findActiveMemberByEmail(db: Database, email: string): Promise<Member | null> {
  const [member] = await db
    .select(memberColumns)
    .from(members)
    .where(and(eq(sql`lower(${members.email})`, email.trim().toLowerCase()), eq(members.active, true)));
  return member ?? null;
}