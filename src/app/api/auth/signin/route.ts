import { NextResponse } from "next/server";
import { clientIp } from "@/features/auth/server/client-ip";
import { findSignInCandidate } from "@/features/auth/server/credentials";
import { verifyPassword } from "@/features/auth/server/crypto";
import { parseEmail, parsePassword } from "@/features/auth/server/input";
import { logRefusedSignIn } from "@/features/auth/server/log";
import { assertSameOrigin, ForbiddenOriginError } from "@/features/auth/server/origin";
import { issueSession, SESSION_COOKIE_NAME, SESSION_LIFETIME_MS } from "@/features/auth/server/sessions";
import {
  assertNotThrottled,
  clearSignInAttempts,
  recordFailure,
  ThrottledError,
} from "@/features/auth/server/throttle";

const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$9qyZvV8b3pqk7qVvIIgCWw$yFiAklIQmjKrc9LI2In8mX62jPzka/OJqGmyszBj3Zs";

const MAX_USER_AGENT_LENGTH = 1000;

export type SignInResult =
  | { result: "ok" }
  | { result: "rejected" }
  | { result: "deactivated"; contact: string | null }
  | { result: "throttled"; retryAfterSeconds: number };

export async function POST(request: Request): Promise<Response> {
  try {
    assertSameOrigin(request);
  } catch (error) {
    if (error instanceof ForbiddenOriginError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    throw error;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const { email: rawEmail, password: rawPassword } = body as { email: unknown; password: unknown };
  const email = parseEmail(rawEmail);
  const password = parsePassword(rawPassword);

  if (email === null || password === null) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const ipAddress = clientIp(request.headers);

  try {
    await assertNotThrottled({ flow: "signin", email, ip: ipAddress });
  } catch (error) {
    if (error instanceof ThrottledError) {
      return NextResponse.json<SignInResult>({
        result: "throttled",
        retryAfterSeconds: error.retryAfterSeconds,
      });
    }
    throw error;
  }

  const candidate = await findSignInCandidate(email);
  const verified = await verifyPassword(candidate?.passwordHash ?? DUMMY_PASSWORD_HASH, password);

  if (!candidate?.passwordHash || !verified) {
    await recordFailure({ flow: "signin", email, ip: ipAddress });
    logRefusedSignIn(email);
    return NextResponse.json<SignInResult>({ result: "rejected" });
  }

  if (candidate.deactivatedAt) {
    return NextResponse.json<SignInResult>({
      result: "deactivated",
      contact: process.env.SUPPORT_EMAIL || null,
    });
  }

  await clearSignInAttempts(email);

  const userAgent = request.headers.get("user-agent")?.slice(0, MAX_USER_AGENT_LENGTH) ?? null;
  const { token } = await issueSession({ userId: candidate.userId, ipAddress, userAgent });

  const response = NextResponse.json<SignInResult>({ result: "ok" });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_LIFETIME_MS / 1000,
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}