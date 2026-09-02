import type { Metadata } from "next";
import { type AcceptState, acceptInvitation } from "@/features/accounts/actions";
import { AcceptInvitationForm } from "@/features/accounts/components/accept-invitation-form";
import { resolveInvitationState } from "@/features/accounts/server/invitations";
import { TOKEN_SHAPE } from "@/features/auth/server/token-state";

export const metadata: Metadata = { title: "Accept invitation" };

export default async function AcceptInvitationPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (token === undefined || !TOKEN_SHAPE.test(token)) {
    return (
      <AcceptInvitationForm
        action={acceptInvitation.bind(null, token ?? "")}
        initialState={{ status: "unknown" }}
        email=""
      />
    );
  }

  const resolved = await resolveInvitationState(token);
  const initialState: AcceptState =
    resolved.state === "valid" ? { status: "idle" } : { status: resolved.state };
  const email = resolved.state === "valid" ? resolved.invitation.email : "";

  return (
    <AcceptInvitationForm
      action={acceptInvitation.bind(null, token)}
      initialState={initialState}
      email={email}
    />
  );
}