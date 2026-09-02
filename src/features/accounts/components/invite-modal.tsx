"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "react-aria-components/Button";
import { Dialog, DialogTrigger } from "react-aria-components/Dialog";
import { Form } from "react-aria-components/Form";
import { Modal } from "react-aria-components/Modal";
import { FieldError, Input, Label, TextField } from "react-aria-components/TextField";
import type { AddressCheck, InviteState } from "../actions";

export type InviteModalAction = (prevState: InviteState, formData: FormData) => Promise<InviteState>;

function InviteModalContent({
  action,
  checkAddress,
  onCreated,
  onJumpToAccount,
  onResendInvitation,
  close,
}: {
  action: InviteModalAction;
  checkAddress: (email: string) => Promise<AddressCheck>;
  onCreated: (mailed: boolean) => void;
  onJumpToAccount: (accountId: string) => void;
  onResendInvitation: (invitationId: string) => void;
  close: () => void;
}) {
  const [state, formAction, isPending] = useActionState(action, { status: "idle" } as InviteState);
  const [email, setEmail] = useState("");
  const [blurCheck, setBlurCheck] = useState<AddressCheck | null>(null);
  const handledStateRef = useRef<InviteState | null>(null);

  useEffect(() => {
    if (state.status === "created" && handledStateRef.current !== state) {
      handledStateRef.current = state;
      onCreated(state.mailed);
      close();
    }
  }, [state, onCreated, close]);

  async function handleBlur() {
    if (email.trim() === "") {
      setBlurCheck(null);
      return;
    }
    const result = await checkAddress(email);
    setBlurCheck(result);
  }

  const refusal: AddressCheck | null =
    state.status === "malformed"
      ? { result: "malformed" }
      : state.status === "has_account"
        ? {
            result: "has_account",
            accountId: state.accountId,
            displayName: state.displayName,
            isDeactivated: state.isDeactivated,
          }
        : state.status === "has_invitation"
          ? { result: "has_invitation", invitationId: state.invitationId }
          : blurCheck;

  return (
    <Dialog className="flex w-full max-w-[420px] flex-col gap-[14px] bg-(--color-bg) p-4 shadow-lg">
      <h2 className="text-h5">Invite someone</h2>
      <Form
        action={formAction}
        validationBehavior="aria"
        className="flex flex-col gap-[14px]">
        <TextField
          name="email"
          type="email"
          value={email}
          onChange={setEmail}
          onBlur={handleBlur}
          isRequired
          isInvalid={refusal?.result === "malformed"}
          className="flex flex-col gap-[5px]">
          <Label>Email</Label>
          <Input placeholder="name@example.com" />
          {refusal?.result === "malformed" && <FieldError>Enter a valid email address.</FieldError>}
        </TextField>

        {refusal?.result === "has_account" && (
          <div
            role="alert"
            className="flex flex-col gap-[6px]">
            <p>
              {refusal.isDeactivated
                ? `${refusal.displayName}'s account is closed.`
                : `${refusal.displayName} already has an account.`}
            </p>
            {refusal.isDeactivated ? (
              <Button type="button">Reactivate</Button>
            ) : (
              <Button
                type="button"
                onPress={() => {
                  const accountId = refusal.accountId;
                  close();
                  onJumpToAccount(accountId);
                }}>
                {refusal.displayName}
              </Button>
            )}
          </div>
        )}

        {refusal?.result === "has_invitation" && (
          <div
            role="alert"
            className="flex flex-col gap-[6px]">
            <p>This address already has an outstanding invitation.</p>
            <Button
              type="button"
              onPress={() => {
                const invitationId = refusal.invitationId;
                close();
                onResendInvitation(invitationId);
              }}>
              Resend
            </Button>
          </div>
        )}

        <div className="flex justify-end gap-[8px]">
          <Button
            type="button"
            onPress={close}>
            Cancel
          </Button>
          <Button
            type="submit"
            isDisabled={isPending}>
            {isPending ? "Sending…" : "Invite"}
          </Button>
        </div>
      </Form>
    </Dialog>
  );
}

export function InviteModal({
  action,
  checkAddress,
  onCreated,
  onJumpToAccount,
  onResendInvitation,
}: {
  action: InviteModalAction;
  checkAddress: (email: string) => Promise<AddressCheck>;
  onCreated: (mailed: boolean) => void;
  onJumpToAccount: (accountId: string) => void;
  onResendInvitation: (invitationId: string) => void;
}) {
  return (
    <DialogTrigger>
      <Button>Invite</Button>
      <Modal
        isDismissable={false}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        {({ state }) => (
          <InviteModalContent
            action={action}
            checkAddress={checkAddress}
            onCreated={onCreated}
            onJumpToAccount={onJumpToAccount}
            onResendInvitation={onResendInvitation}
            close={state.close}
          />
        )}
      </Modal>
    </DialogTrigger>
  );
}