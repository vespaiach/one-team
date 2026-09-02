import type { Metadata } from "next";
import { type CompletePasswordResetState, completePasswordReset } from "@/features/auth/actions";
import { ChangePasswordForm } from "@/features/auth/components/change-password-form";
import { ResetRequestForm } from "@/features/auth/components/reset-request-form";
import { getUserEmail } from "@/features/auth/server/credentials";
import { resolveResetTokenState } from "@/features/auth/server/reset-tokens";
import { TOKEN_SHAPE } from "@/features/auth/server/token-state";

export const metadata: Metadata = { title: "Reset password" };

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;

  if (token === undefined) {
    return <ResetRequestForm />;
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
  const email =
    resolved.state === "valid" && resolved.resetToken
      ? ((await getUserEmail(resolved.resetToken.userId)) ?? undefined)
      : undefined;

  return (
    <ChangePasswordForm
      action={completePasswordReset.bind(null, token)}
      initialState={initialState}
      email={email}
    />
  );
}