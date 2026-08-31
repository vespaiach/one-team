import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { credential, user } from "@/db/schema";

export type SignInCandidate = {
  userId: string;
  role: string;
  deactivatedAt: Date | null;
  passwordHash: string | null;
};

export async function findSignInCandidate(email: string): Promise<SignInCandidate | null> {
  const [row] = await db
    .select({
      userId: user.id,
      role: user.role,
      deactivatedAt: user.deactivatedAt,
      passwordHash: credential.passwordHash,
    })
    .from(user)
    .leftJoin(credential, eq(credential.userId, user.id))
    .where(sql`lower(${user.email}) = ${email}`);

  return row ?? null;
}