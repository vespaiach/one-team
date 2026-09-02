"use server";

import { and, eq, isNull, sql, TransactionRollbackError } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { db } from "@/db";
import { invite, user } from "@/db/schema";
import { touched } from "@/db/touched";
import { isUniqueViolation } from "@/db/unique-violation";
import { requireActor } from "@/features/auth/server/actor";
import { clientIp } from "@/features/auth/server/client-ip";
import { createCredential } from "@/features/auth/server/credentials";
import { hashPassword } from "@/features/auth/server/crypto";
import { parseEmail } from "@/features/auth/server/input";
import { logUnhandledServerError } from "@/features/auth/server/log";
import { assertSameOrigin } from "@/features/auth/server/origin";
import { assertPasswordPolicy, type PasswordPolicyFailure } from "@/features/auth/server/password-policy";
import { issueSession, SESSION_COOKIE_NAME, SESSION_COOKIE_OPTIONS } from "@/features/auth/server/sessions";
import { deactivateAccount, reactivateAccount } from "./server/accounts";
import {
  issueInvitation,
  resendInvitation,
  resolveInvitationState,
  revokeInvitation,
  spendInvitation,
} from "./server/invitations";
import { sendInvitationMail } from "./server/mail";

const ACCOUNTS_SCREEN_PATH = "/settings/accounts";
const MAX_USER_AGENT_LENGTH = 1000;

export type AddressCheck =
  | { result: "ok" }
  | { result: "malformed" }
  | { result: "has_invitation"; invitationId: string }
  | { result: "has_account"; accountId: string; displayName: string; isDeactivated: boolean };

export type InviteState =
  | { status: "idle" }
  | { status: "created"; mailed: boolean }
  | { status: "malformed" }
  | { status: "has_account"; accountId: string; displayName: string; isDeactivated: boolean }
  | { status: "has_invitation"; invitationId: string };

export type ResendState = { status: "done"; mailed: boolean } | { status: "not_found" };

export type RevokeState = { status: "done" } | { status: "not_found" };

export type AcceptState =
  | { status: "idle" }
  | { status: "policy"; failure: PasswordPolicyFailure }
  | { status: "names" }
  | { status: "used" }
  | { status: "expired" }
  | { status: "unknown" }
  | { status: "taken" };

export type AccountState =
  | { status: "idle" }
  | { status: "done" }
  | { status: "last_admin" }
  | { status: "unchanged" }
  | { status: "forbidden" }
  | { status: "offline" };

function handleUnexpectedError(error: unknown, subjectId: string): never {
  unstable_rethrow(error);
  logUnhandledServerError(subjectId);
  throw new Error("Something went wrong. Please try again.");
}

function readFormString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function requireAdmin(): Promise<{ id: string }> {
  const actor = await requireActor();
  if (actor.role !== "admin") {
    throw new Error("forbidden");
  }
  return actor;
}

async function findAccountByEmail(email: string) {
  const [account] = await db
    .select({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      deactivatedAt: user.deactivatedAt,
    })
    .from(user)
    .where(sql`lower(${user.email}) = ${email}`);

  return account ?? null;
}

async function findOutstandingInvitationByEmail(email: string) {
  const [outstanding] = await db
    .select({ id: invite.id })
    .from(invite)
    .where(and(sql`lower(${invite.email}) = ${email}`, isNull(invite.acceptedAt)));

  return outstanding ?? null;
}

export async function checkInviteAddress(email: unknown): Promise<AddressCheck> {
  assertSameOrigin({ headers: await headers() });
  await requireAdmin();

  const parsed = parseEmail(email);
  if (parsed === null) {
    return { result: "malformed" };
  }

  const existingAccount = await findAccountByEmail(parsed);
  if (existingAccount) {
    return {
      result: "has_account",
      accountId: existingAccount.id,
      displayName: `${existingAccount.firstName} ${existingAccount.lastName}`,
      isDeactivated: existingAccount.deactivatedAt !== null,
    };
  }

  const outstandingInvite = await findOutstandingInvitationByEmail(parsed);
  if (outstandingInvite) {
    return { result: "has_invitation", invitationId: outstandingInvite.id };
  }

  return { result: "ok" };
}

export async function inviteUser(_prevState: InviteState, formData: FormData): Promise<InviteState> {
  assertSameOrigin({ headers: await headers() });
  const actor = await requireAdmin();

  const parsed = parseEmail(formData.get("email"));
  if (parsed === null) {
    return { status: "malformed" };
  }

  const existingAccount = await findAccountByEmail(parsed);
  if (existingAccount) {
    return {
      status: "has_account",
      accountId: existingAccount.id,
      displayName: `${existingAccount.firstName} ${existingAccount.lastName}`,
      isDeactivated: existingAccount.deactivatedAt !== null,
    };
  }

  const outstandingInvite = await findOutstandingInvitationByEmail(parsed);
  if (outstandingInvite) {
    return { status: "has_invitation", invitationId: outstandingInvite.id };
  }

  let issued: Awaited<ReturnType<typeof issueInvitation>>;
  try {
    issued = await issueInvitation({ email: parsed, invitedBy: actor.id });
  } catch (error) {
    if (isUniqueViolation(error)) {
      const raced = await findOutstandingInvitationByEmail(parsed);
      if (raced) {
        return { status: "has_invitation", invitationId: raced.id };
      }
    }
    handleUnexpectedError(error, parsed);
  }

  try {
    const mailOutcome = await sendInvitationMail({
      to: parsed,
      token: issued.token,
      expiresAt: issued.invitation.expiresAt,
    });

    revalidatePath(ACCOUNTS_SCREEN_PATH);

    return { status: "created", mailed: mailOutcome === "sent" };
  } catch (error) {
    handleUnexpectedError(error, issued.invitation.id);
  }
}

export async function resendInvite(invitationId: string): Promise<ResendState> {
  assertSameOrigin({ headers: await headers() });
  await requireAdmin();

  try {
    const resent = await resendInvitation(invitationId);
    if (!resent) {
      return { status: "not_found" };
    }

    const mailOutcome = await sendInvitationMail({
      to: resent.invitation.email,
      token: resent.token,
      expiresAt: resent.invitation.expiresAt,
    });

    revalidatePath(ACCOUNTS_SCREEN_PATH);

    return { status: "done", mailed: mailOutcome === "sent" };
  } catch (error) {
    handleUnexpectedError(error, invitationId);
  }
}

export async function revokeInvite(invitationId: string): Promise<RevokeState> {
  assertSameOrigin({ headers: await headers() });
  await requireAdmin();

  try {
    const revoked = await revokeInvitation(invitationId);
    if (!revoked) {
      return { status: "not_found" };
    }

    revalidatePath(ACCOUNTS_SCREEN_PATH);

    return { status: "done" };
  } catch (error) {
    handleUnexpectedError(error, invitationId);
  }
}

export async function acceptInvitation(
  token: string,
  _prevState: AcceptState,
  formData: FormData,
): Promise<AcceptState> {
  const requestHeaders = await headers();
  assertSameOrigin({ headers: requestHeaders });

  const firstName = readFormString(formData, "firstName").trim();
  const lastName = readFormString(formData, "lastName").trim();
  const password = readFormString(formData, "password");

  if (firstName === "" || lastName === "") {
    return { status: "names" };
  }

  const policyFailure = assertPasswordPolicy(password);
  if (policyFailure) {
    return { status: "policy", failure: policyFailure };
  }

  const resolved = await resolveInvitationState(token);
  if (resolved.state !== "valid") {
    return { status: resolved.state };
  }
  const invitationId = resolved.invitation.id;
  const email = resolved.invitation.email;

  let outcome: "used" | "unknown" | "taken" | null = null;
  let sessionToken: string | null = null;

  try {
    await db.transaction(async (tx) => {
      const spent = await spendInvitation(tx, invitationId);
      if (!spent) {
        const [stillExists] = await tx
          .select({ id: invite.id })
          .from(invite)
          .where(eq(invite.id, invitationId));
        outcome = stillExists ? "used" : "unknown";
        return;
      }

      const now = new Date();
      const passwordHash = await hashPassword(password);

      let createdUser: typeof user.$inferSelect;
      try {
        const [row] = await tx
          .insert(user)
          .values(
            touched({
              firstName,
              lastName,
              email,
              role: "member",
              mustChangePassword: false,
              createdAt: now,
            }),
          )
          .returning();
        if (!row) {
          throw new Error("acceptInvitation produced no user row");
        }
        createdUser = row;
      } catch (error) {
        if (!isUniqueViolation(error)) {
          throw error;
        }
        outcome = "taken";
        tx.rollback();
        return;
      }

      await createCredential(tx, { userId: createdUser.id, passwordHash, now });

      const ipAddress = clientIp(requestHeaders);
      const userAgent = requestHeaders.get("user-agent")?.slice(0, MAX_USER_AGENT_LENGTH) ?? null;
      const issued = await issueSession({ userId: createdUser.id, ipAddress, userAgent }, tx);
      sessionToken = issued.token;
    });
  } catch (error) {
    if (!(error instanceof TransactionRollbackError)) {
      handleUnexpectedError(error, invitationId);
    }
  }

  if (outcome !== null) {
    return { status: outcome };
  }

  if (!sessionToken) {
    handleUnexpectedError(new Error("acceptInvitation produced no session"), invitationId);
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, SESSION_COOKIE_OPTIONS);
  redirect("/home");
}

export async function deactivateUser(accountId: string): Promise<AccountState> {
  assertSameOrigin({ headers: await headers() });
  const actor = await requireActor();
  if (actor.role !== "admin") {
    return { status: "forbidden" };
  }

  try {
    const result = await deactivateAccount(accountId);
    if (result === "last_admin" || result === "unchanged") {
      return { status: result };
    }

    revalidatePath(ACCOUNTS_SCREEN_PATH);

    if (actor.id === accountId) {
      redirect("/signin");
    }

    return { status: "done" };
  } catch (error) {
    handleUnexpectedError(error, accountId);
  }
}

export async function reactivateUser(accountId: string): Promise<AccountState> {
  assertSameOrigin({ headers: await headers() });
  const actor = await requireActor();
  if (actor.role !== "admin") {
    return { status: "forbidden" };
  }

  try {
    const result = await reactivateAccount(accountId);
    if (result === "unchanged") {
      return { status: "unchanged" };
    }

    revalidatePath(ACCOUNTS_SCREEN_PATH);

    return { status: "done" };
  } catch (error) {
    handleUnexpectedError(error, accountId);
  }
}