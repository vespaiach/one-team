import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { touched } from "@/db/touched";
import { LastAdminRefusal, withLastAdminGuard } from "@/features/auth/server/admin-guard";
import { deleteAllSessionsForUser } from "@/features/auth/server/sessions";

export type AccountMutationResult = "done" | "unchanged" | "last_admin";

export async function deactivateAccount(
  accountId: string,
  now: Date = new Date(),
): Promise<AccountMutationResult> {
  try {
    return await db.transaction(async (tx) => {
      return withLastAdminGuard(tx, accountId, async () => {
        const [target] = await tx
          .select({ deactivatedAt: user.deactivatedAt })
          .from(user)
          .where(eq(user.id, accountId))
          .for("update");

        if (!target) {
          throw new Error("deactivateAccount: account not found");
        }
        if (target.deactivatedAt !== null) {
          return "unchanged" as const;
        }

        await tx
          .update(user)
          .set(touched({ deactivatedAt: now }))
          .where(eq(user.id, accountId));
        await deleteAllSessionsForUser(accountId, tx);

        return "done" as const;
      });
    });
  } catch (error) {
    if (error instanceof LastAdminRefusal) {
      return "last_admin";
    }
    throw error;
  }
}

export async function reactivateAccount(
  accountId: string,
): Promise<Exclude<AccountMutationResult, "last_admin">> {
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ deactivatedAt: user.deactivatedAt })
      .from(user)
      .where(eq(user.id, accountId))
      .for("update");

    if (!target) {
      throw new Error("reactivateAccount: account not found");
    }
    if (target.deactivatedAt === null) {
      return "unchanged";
    }

    await tx
      .update(user)
      .set(touched({ deactivatedAt: null }))
      .where(eq(user.id, accountId));

    return "done";
  });
}