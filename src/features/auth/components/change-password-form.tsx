"use client";

import { useActionState } from "react";
import { Button } from "react-aria-components/Button";
import { Form } from "react-aria-components/Form";
import { Link } from "react-aria-components/Link";
import type { CompletePasswordResetAction, CompletePasswordResetState } from "../actions";
import type { PasswordPolicyFailure } from "../server/password-policy";
import { BackToSignInFooter } from "./back-to-sign-in-footer";
import { Banner } from "./banner";
import { CardFooterNote } from "./card-footer-note";
import { KeyRoundIcon, LockIcon, RefreshCwIcon } from "./icons";
import { PasswordField } from "./password-field";
import { primaryButtonClasses } from "./primary-button-classes";

const POLICY_MESSAGES: Record<PasswordPolicyFailure, string> = {
  too_short: "Must be at least 12 characters.",
  too_long: "Must be no more than 128 characters.",
  blocklisted: "This password is too common. Choose another.",
};

const TOKEN_STATE_COPY = {
  expired: {
    heading: "This link has expired",
    message: "This link has expired. Reset links last one hour.",
  },
  used: {
    heading: "This link has already been used",
    message: "This link has already been used. Your password was changed with it.",
  },
  unknown: {
    heading: "This link isn't one we recognise",
    message: "This link isn't one we recognise. Check the whole address came across from the email.",
  },
} as const;

export function ChangePasswordForm({
  action,
  initialState,
  email,
}: {
  action: CompletePasswordResetAction;
  initialState: CompletePasswordResetState;
  email?: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  if (state.status === "expired" || state.status === "used" || state.status === "unknown") {
    const copy = TOKEN_STATE_COPY[state.status];
    return (
      <div className="flex flex-col gap-[14px]">
        <h1 className="text-h4">{copy.heading}</h1>
        <Banner icon={LockIcon}>{copy.message}</Banner>
        <Link
          href="/reset"
          className={`mt-[6px] no-underline ${primaryButtonClasses()}`}>
          <RefreshCwIcon size={16} />
          Request a new link
        </Link>
        <BackToSignInFooter />
      </div>
    );
  }

  return (
    <Form
      action={formAction}
      validationBehavior="aria"
      className="flex flex-col gap-[14px]">
      <h1 className="text-h4 mb-[6px]">Set a new password</h1>
      <p className="mb-[10px] text-[13px] text-[color-mix(in_srgb,var(--color-text)_62%,transparent)]">
        {email ? (
          <>
            For <b className="text-[var(--color-text)]">{email}</b>. This link is single-use.
          </>
        ) : (
          "This link is single-use."
        )}
      </p>
      <PasswordField
        name="password"
        label="New password"
        placeholder="At least 12 characters"
        isRequired
        isInvalid={state.status === "policy"}
        errorMessage={state.status === "policy" ? POLICY_MESSAGES[state.failure] : undefined}
        hint="Twelve characters minimum. No other rules, but common passwords are refused."
      />
      <PasswordField
        name="confirmPassword"
        label="Confirm password"
        placeholder="Repeat it"
        isRequired
        isInvalid={state.status === "mismatch"}
        errorMessage={state.status === "mismatch" ? "These two don't match." : undefined}
      />
      <Button
        type="submit"
        isDisabled={isPending}
        className={primaryButtonClasses({ pending: isPending })}>
        <KeyRoundIcon size={16} />
        {isPending ? "Saving…" : "Save password"}
      </Button>
      <CardFooterNote>Saving signs out every session on this account, including this browser.</CardFooterNote>
    </Form>
  );
}