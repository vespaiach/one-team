"use client";

import { useActionState } from "react";
import { Button } from "react-aria-components/Button";
import { Form } from "react-aria-components/Form";
import { Link } from "react-aria-components/Link";
import { FieldError, Input, Label, TextField } from "react-aria-components/TextField";
import { Banner } from "@/features/auth/components/banner";
import { KeyRoundIcon, LockIcon } from "@/features/auth/components/icons";
import { PasswordField } from "@/features/auth/components/password-field";
import { primaryButtonClasses } from "@/features/auth/components/primary-button-classes";
import type { PasswordPolicyFailure } from "@/features/auth/server/password-policy";
import type { AcceptState } from "../actions";

const POLICY_MESSAGES: Record<PasswordPolicyFailure, string> = {
  too_short: "Must be at least 12 characters.",
  too_long: "Must be no more than 128 characters.",
  blocklisted: "This password is too common. Choose another.",
};

const DEAD_LINK_COPY = {
  expired: {
    heading: "This link has expired",
    message: "This invitation has expired. Ask an administrator to send a new one.",
  },
  used: {
    heading: "This link has already been used",
    message: "This invitation has already been used. Sign in if you already have an account.",
  },
  unknown: {
    heading: "This link isn't one we recognise",
    message: "This link isn't one we recognise. Check the whole address came across from the email.",
  },
  taken: {
    heading: "This address already has an account",
    message: "This address already has an account. Sign in instead.",
  },
} as const;

function NameField({ name, label, isInvalid }: { name: string; label: string; isInvalid: boolean }) {
  return (
    <TextField
      name={name}
      isRequired
      isInvalid={isInvalid}
      className="flex flex-col gap-[5px]">
      <Label className="text-[12px] text-[color-mix(in_srgb,var(--color-text)_70%,transparent)]">
        {label}
      </Label>
      <Input className="h-[36px] w-full border border-[var(--color-divider)] bg-[var(--color-surface)] px-[10px] py-[6px] text-[14px] text-[var(--color-text)] caret-[var(--color-accent)] data-[invalid]:border-[var(--color-accent)]" />
      {isInvalid && <FieldError className="text-[12px] text-[var(--color-accent-700)]">Required.</FieldError>}
    </TextField>
  );
}

export type AcceptInvitationAction = (prevState: AcceptState, formData: FormData) => Promise<AcceptState>;

export function AcceptInvitationForm({
  action,
  initialState,
  email,
}: {
  action: AcceptInvitationAction;
  initialState: AcceptState;
  email: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  if (
    state.status === "expired" ||
    state.status === "used" ||
    state.status === "unknown" ||
    state.status === "taken"
  ) {
    const copy = DEAD_LINK_COPY[state.status];
    return (
      <div className="flex flex-col gap-[14px]">
        <h1 className="text-h4">{copy.heading}</h1>
        <Banner icon={LockIcon}>{copy.message}</Banner>
        <Link
          href="/signin"
          className={`mt-[6px] no-underline ${primaryButtonClasses()}`}>
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <Form
      action={formAction}
      validationBehavior="aria"
      className="flex flex-col gap-[14px]">
      <h1 className="text-h4 mb-[6px]">You've been invited</h1>
      <p className="mb-[10px] text-[13px] text-[color-mix(in_srgb,var(--color-text)_62%,transparent)]">
        This invitation was sent to <b className="text-[var(--color-text)]">{email}</b>.
      </p>
      <NameField
        name="firstName"
        label="First name"
        isInvalid={state.status === "names"}
      />
      <NameField
        name="lastName"
        label="Last name"
        isInvalid={state.status === "names"}
      />
      <PasswordField
        name="password"
        label="Password"
        placeholder="At least 12 characters"
        isRequired
        isInvalid={state.status === "policy"}
        errorMessage={state.status === "policy" ? POLICY_MESSAGES[state.failure] : undefined}
        hint="Twelve characters minimum. No other rules, but common passwords are refused."
      />
      <Button
        type="submit"
        isDisabled={isPending}
        className={primaryButtonClasses({ pending: isPending })}>
        <KeyRoundIcon size={16} />
        {isPending ? "Creating account…" : "Create account"}
      </Button>
    </Form>
  );
}