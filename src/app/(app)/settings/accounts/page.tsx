import { forbidden } from "next/navigation";
import {
  checkInviteAddress,
  deactivateUser,
  inviteUser,
  reactivateUser,
  resendInvite,
  revokeInvite,
} from "@/features/accounts/actions";
import { AccountsScreen } from "@/features/accounts/components/accounts-screen";
import { listOutstandingInvitations, loadRoster } from "@/features/accounts/server/roster";
import { requireActor } from "@/features/auth/server/actor";
import { ScreenHeader } from "@/features/shell/components/screen-header";

export default async function AccountsPage() {
  const actor = await requireActor();
  if (actor.role !== "admin") {
    forbidden();
  }

  const [invitationsResult, rosterResult] = await Promise.allSettled([
    listOutstandingInvitations(),
    loadRoster(),
  ]);

  return (
    <>
      <ScreenHeader name="Accounts" />
      <AccountsScreen
        invitations={invitationsResult.status === "fulfilled" ? invitationsResult.value : null}
        roster={rosterResult.status === "fulfilled" ? rosterResult.value : null}
        inviteAction={inviteUser}
        checkAddress={checkInviteAddress}
        resendInvite={resendInvite}
        revokeInvite={revokeInvite}
        deactivateUser={deactivateUser}
        reactivateUser={reactivateUser}
      />
    </>
  );
}