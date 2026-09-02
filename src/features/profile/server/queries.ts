import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { accountUser } from "@/features/auth/server/projections";

export type ProfileRecord = {
  avatarUrl: string | null;
  firstName: string;
  lastName: string;
  jobTitle: string | null;
  slackHandle: string | null;
  phone: string | null;
  bio: string | null;
  email: string;
  role: string;
};

export async function getOwnProfile(userId: string): Promise<ProfileRecord | null> {
  const [row] = await db.select(accountUser).from(user).where(eq(user.id, userId));
  if (!row) {
    return null;
  }
  return {
    avatarUrl: row.avatarUrl,
    firstName: row.firstName,
    lastName: row.lastName,
    jobTitle: row.jobTitle,
    slackHandle: row.slackHandle,
    phone: row.phone,
    bio: row.bio,
    email: row.email,
    role: row.role,
  };
}