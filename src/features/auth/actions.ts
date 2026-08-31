"use server";

import { eq, TransactionRollbackError } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { credential, user } from "@/db/schema";
import { touched } from "@/db/touched";
import { clientIp } from "./server/client-ip";
import { hashPassword } from "./server/crypto";
import { parseEmail } from "./server/input";
import { sendPasswordResetMail } from "./server/mail";
import { assertSameOrigin } from "./server/origin";
import { assertPasswordPolicy, type PasswordPolicyFailure } from "./server/password-policy";
import { issueResetToken, resolveResetTokenState, spendResetToken } from "./server/reset-tokens";
import { deleteAllSessionsForUser } from "./server/sessions";
import { assertNotThrottled, recordFailure, ThrottledError } from "./server/throttle";

export type RequestPasswordResetState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "throttled"; retryAfterSeconds: number };

export type CompletePasswordResetState =
  | { status: "idle" }
  | { status: "mismatch" }
  | { status: "policy"; failure: PasswordPolicyFailure }
  | { status: "used" }
  | { status: "expired" }
  | { status: "unknown" };

function readFormString(formData: FormData, name: string): string | null {
  const value = formData.get(name);
  return typeof value === "string" ? value : null;
}

export type CompletePasswordResetAction = (
  prevState: CompletePasswordResetState,
  formData: FormData,
) => Promise<CompletePasswordResetState>;

export async function requestPasswordReset(
  _prevState: RequestPasswordResetState,
  formData: FormData,
): Promise<RequestPasswordResetState> {
  const requestHeaders = await headers();
  assertSameOrigin({ headers: requestHeaders });

  const email = parseEmail(formData.get("email"));
  if (email !== null) {
    const ip = clientIp(requestHeaders);

    try {
      await assertNotThrottled({ flow: "reset", email, ip });
    } catch (error) {
      if (error instanceof ThrottledError) {
        return { status: "throttled", retryAfterSeconds: error.retryAfterSeconds };
      }
      throw error;
    }

    await recordFailure({ flow: "reset", email, ip });

    const [row] = await db
      .select({ userId: user.id, deactivatedAt: user.deactivatedAt, credentialId: credential.id })
      .from(user)
      .leftJoin(credential, eq(credential.userId, user.id))
      .where(eq(user.email, email));

    if (row && row.deactivatedAt === null && row.credentialId !== null) {
      const { token } = await issueResetToken({ userId: row.userId });
      await sendPasswordResetMail({ to: email, token });
    }
  }

  return { status: "sent" };
}

export async function completePasswordReset(
  token: string,
  _prevState: CompletePasswordResetState,
  formData: FormData,
): Promise<CompletePasswordResetState> {
  assertSameOrigin({ headers: await headers() });

  const password = readFormString(formData, "password");
  const confirmPassword = readFormString(formData, "confirmPassword");

  if (password === null || confirmPassword === null) {
    return { status: "unknown" };
  }
  if (password !== confirmPassword) {
    return { status: "mismatch" };
  }
  const policyFailure = assertPasswordPolicy(password);
  if (policyFailure) {
    return { status: "policy", failure: policyFailure };
  }

  const resolved = await resolveResetTokenState(token);
  if (resolved.state === "used" || resolved.state === "expired" || resolved.state === "unknown") {
    return { status: resolved.state };
  }
  if (!resolved.resetToken) {
    return { status: "unknown" };
  }
  const ownerId = resolved.resetToken.userId;
  const resetTokenId = resolved.resetToken.id;

  let ownerMayNotSignIn = false;
  try {
    await db.transaction(async (tx) => {
      const spent = await spendResetToken(tx, resetTokenId);
      if (!spent) {
        tx.rollback();
      }

      const [owner] = await tx
        .select({ deactivatedAt: user.deactivatedAt })
        .from(user)
        .where(eq(user.id, ownerId));
      if (!owner || owner.deactivatedAt !== null) {
        ownerMayNotSignIn = true;
        return;
      }

      const hash = await hashPassword(password);
      await tx
        .update(credential)
        .set(touched({ passwordHash: hash }))
        .where(eq(credential.userId, ownerId));
      await tx
        .update(user)
        .set(touched({ mustChangePassword: false }))
        .where(eq(user.id, ownerId));
      await deleteAllSessionsForUser(ownerId, tx);
    });
  } catch (error) {
    if (error instanceof TransactionRollbackError) {
      return { status: "used" };
    }
    throw error;
  }

  if (ownerMayNotSignIn) {
    return { status: "unknown" };
  }

  redirect("/signin?reset=done");
}