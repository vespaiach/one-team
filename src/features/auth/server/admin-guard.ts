import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import type { db } from "../../../db/index.ts";
import { user } from "../../../db/schema.ts";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class LastAdminRefusal extends Error {
  constructor() {
    super("refusing a change that would leave the installation with no active admin");
  }
}

export async function withLastAdminGuard<T>(
  tx: Transaction,
  targetUserId: string,
  apply: () => Promise<T>,
): Promise<T> {
  const activeAdmins = await tx
    .select({ id: user.id })
    .from(user)
    .where(and(eq(user.role, "admin"), isNull(user.deactivatedAt)))
    .for("update");

  const targetIsActiveAdmin = activeAdmins.some((row) => row.id === targetUserId);
  if (targetIsActiveAdmin && activeAdmins.length <= 1) {
    throw new LastAdminRefusal();
  }

  return apply();
}