import type { Metadata } from "next";
import { type CompletePasswordResetState, completePasswordReset } from "@/features/auth/actions";
import { ChangePasswordForm } from "@/features/auth/components/change-password-form";
import { ResetRequestForm } from "@/features/auth/components/reset-request-form";
import { resolveResetTokenState } from "@/features/auth/server/reset-tokens";

export const metadata: Metadata = { title: "Reset password" };

const TOKEN_SHAPE = /^[A-Za-z0-9_-]{20,}$/;

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  if (token === undefined) {
    return (
      <>
        <h1 className="text-h3">Forgot password</h1>
        <ResetRequestForm />
      </>
    );
  }

  if (!TOKEN_SHAPE.test(token)) {
    return (
      <ChangePasswordForm
        action={completePasswordReset.bind(null, token)}
        initialState={{ status: "unknown" }}
      />
    );
  }

  const resolved = await resolveResetTokenState(token);
  const initialState: CompletePasswordResetState =
    resolved.state === "valid" ? { status: "idle" } : { status: resolved.state };

  return (
    <ChangePasswordForm
      action={completePasswordReset.bind(null, token)}
      initialState={initialState}
    />
  );
}