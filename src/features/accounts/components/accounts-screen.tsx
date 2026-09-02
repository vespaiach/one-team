"use client";

import { useState } from "react";
import { Button } from "react-aria-components/Button";
import { Tab, TabList, TabPanel, Tabs } from "react-aria-components/Tabs";
import type { AccountState, AddressCheck, ResendState, RevokeState } from "../actions";
import type { InvitationRow, RosterView } from "../server/roster";
import { ConnectionBanner, guardedWrite } from "./connection-banner";
import { InvitationsTable } from "./invitations-table";
import type { InviteModalAction } from "./invite-modal";
import { InviteModal } from "./invite-modal";
import { RosterTable } from "./roster-table";
import { showToast, ToastRegion } from "./toast-region";

function ReadFailure() {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-[10px] p-4">
      <p>This data could not be loaded.</p>
      <Button onPress={() => window.location.reload()}>Retry</Button>
    </div>
  );
}

export function AccountsScreen({
  invitations,
  roster,
  inviteAction,
  checkAddress,
  resendInvite,
  revokeInvite,
  deactivateUser,
  reactivateUser,
}: {
  invitations: InvitationRow[] | null;
  roster: RosterView | null;
  inviteAction: InviteModalAction;
  checkAddress: (email: string) => Promise<AddressCheck>;
  resendInvite: (invitationId: string) => Promise<ResendState>;
  revokeInvite: (invitationId: string) => Promise<RevokeState>;
  deactivateUser: (accountId: string) => Promise<AccountState>;
  reactivateUser: (accountId: string) => Promise<AccountState>;
}) {
  const [selectedKey, setSelectedKey] = useState<string>("invitations");
  const [highlightedAccountId, setHighlightedAccountId] = useState<string | null>(null);

  function handleJumpToAccount(accountId: string) {
    setSelectedKey("accounts");
    setHighlightedAccountId(accountId);
  }

  async function handleResend(invitationId: string) {
    const outcome = await guardedWrite(() => resendInvite(invitationId));
    if (!outcome.performed) {
      showToast({ kind: "error", message: outcome.reason });
      return;
    }
    if (outcome.result.status === "done") {
      showToast(
        outcome.result.mailed
          ? { kind: "success", message: "Invitation resent." }
          : { kind: "warning", message: "Invitation resent, but the mail did not go." },
      );
    } else {
      showToast({ kind: "error", message: "That invitation could not be found." });
    }
  }

  async function handleRevoke(invitationId: string) {
    const outcome = await guardedWrite(() => revokeInvite(invitationId));
    if (!outcome.performed) {
      showToast({ kind: "error", message: outcome.reason });
      return;
    }
    if (outcome.result.status === "done") {
      showToast({ kind: "success", message: "Invitation revoked." });
    } else {
      showToast({ kind: "error", message: "That invitation could not be found." });
    }
  }

  async function handleDeactivate(accountId: string) {
    const outcome = await guardedWrite(() => deactivateUser(accountId));
    if (!outcome.performed) {
      showToast({ kind: "error", message: outcome.reason });
      return;
    }
    if (outcome.result.status === "done") {
      showToast({ kind: "success", message: "Account deactivated." });
    } else if (outcome.result.status === "last_admin") {
      showToast({ kind: "error", message: "The last active admin can't be deactivated." });
    } else {
      showToast({ kind: "error", message: "That change could not be made." });
    }
  }

  async function handleReactivate(accountId: string) {
    const outcome = await guardedWrite(() => reactivateUser(accountId));
    if (!outcome.performed) {
      showToast({ kind: "error", message: outcome.reason });
      return;
    }
    if (outcome.result.status === "done") {
      showToast({ kind: "success", message: "Account reactivated." });
    } else {
      showToast({ kind: "error", message: "That change could not be made." });
    }
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <ConnectionBanner />
      <ToastRegion />
      <Tabs
        selectedKey={selectedKey}
        onSelectionChange={(key) => setSelectedKey(String(key))}>
        <TabList aria-label="Accounts sections">
          <Tab id="invitations">Invitations</Tab>
          <Tab id="accounts">Accounts</Tab>
        </TabList>
        <TabPanel id="invitations">
          <InviteModal
            action={inviteAction}
            checkAddress={checkAddress}
            onCreated={(mailed) =>
              showToast(
                mailed
                  ? { kind: "success", message: "Invitation sent." }
                  : { kind: "warning", message: "Invitation created, but the mail did not go." },
              )
            }
            onJumpToAccount={handleJumpToAccount}
            onResendInvitation={handleResend}
          />
          {invitations === null ? (
            <ReadFailure />
          ) : (
            <InvitationsTable
              rows={invitations}
              onResend={handleResend}
              onRevoke={handleRevoke}
            />
          )}
        </TabPanel>
        <TabPanel id="accounts">
          {roster === null ? (
            <ReadFailure />
          ) : (
            <RosterTable
              rows={roster.rows}
              activeAdminCount={roster.activeAdminCount}
              highlightedAccountId={highlightedAccountId}
              onClearHighlight={() => setHighlightedAccountId(null)}
              onDeactivate={handleDeactivate}
              onReactivate={handleReactivate}
            />
          )}
        </TabPanel>
      </Tabs>
    </div>
  );
}