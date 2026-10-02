import type { Sql } from "postgres";
import { isValidEmail } from "./emailAddress.ts";

export type Member = {
  id: string;
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

export async function createFirstAdmin(sql: Sql, input: ProfileInput): Promise<CreateFirstAdminResult> {
  const validated = validateProfile(input);
  if (!validated.ok) {
    return validated;
  }
  const { email, fullName, username } = validated.profile;
  return sql.begin(async (tx): Promise<CreateFirstAdminResult> => {
    await tx`lock table members in share row exclusive mode`;
    const existing = await tx`select 1 from members limit 1`;
    if (existing.length > 0) {
      return { ok: false, error: "Setup already done" };
    }
    const [member] = await tx<Member[]>`
      insert into members (email, full_name, username, role)
      values (${email}, ${fullName}, ${username}, 'admin')
      returning id::text as id, full_name as "fullName", username, role
    `;
    return { ok: true, member };
  });
}

export async function findActiveMemberByEmail(sql: Sql, email: string): Promise<Member | null> {
  const [member] = await sql<Member[]>`
    select id::text as id, full_name as "fullName", username, role
    from members
    where lower(email) = ${email.trim().toLowerCase()} and active
  `;
  return member ?? null;
}