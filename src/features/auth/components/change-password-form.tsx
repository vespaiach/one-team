"use client";

import { useActionState } from "react";
import { Button } from "react-aria-components/Button";
import { Form } from "react-aria-components/Form";
import { FieldError, Input, Label, TextField } from "react-aria-components/TextField";
import type { CompletePasswordResetAction, CompletePasswordResetState } from "../actions";
import type { PasswordPolicyFailure } from "../server/password-policy";

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
}: {
  action: CompletePasswordResetAction;
  initialState: CompletePasswordResetState;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  if (state.status === "expired" || state.status === "used" || state.status === "unknown") {
    const copy = TOKEN_STATE_COPY[state.status];
    return (
      <output className="flex flex-col gap-4 border-t-2 border-[var(--color-border-strong)] bg-[var(--color-surface-sunken)] p-4">
        <h1 className="text-h3">{copy.heading}</h1>
        <p>{copy.message}</p>
        <a
          href="/reset"
          className="self-start">
          Request a new link
        </a>
      </output>
    );
  }

  return (
    <Form
      action={formAction}
      validationBehavior="aria"
      className="flex flex-col gap-6">
      <h1 className="text-h3">Change password</h1>
      <p className="text-label text-[var(--color-text-muted)]">
        At least twelve characters. Nothing else is required.
      </p>
      <TextField
        name="password"
        type="password"
        isRequired
        isInvalid={state.status === "policy"}
        className="flex flex-col gap-2">
        <Label>New password</Label>
        <Input className="h-[var(--size-field)] border border-[var(--color-border-control)] px-3" />
        <FieldError className="text-label text-[var(--color-danger-text)]">
          {state.status === "policy" ? POLICY_MESSAGES[state.failure] : undefined}
        </FieldError>
      </TextField>
      <TextField
        name="confirmPassword"
        type="password"
        isRequired
        isInvalid={state.status === "mismatch"}
        className="flex flex-col gap-2">
        <Label>Confirm password</Label>
        <Input className="h-[var(--size-field)] border border-[var(--color-border-control)] px-3" />
        <FieldError className="text-label text-[var(--color-danger-text)]">
          {state.status === "mismatch" ? "The passwords don't match." : undefined}
        </FieldError>
      </TextField>
      <Button
        type="submit"
        isDisabled={isPending}
        className="h-[var(--size-field)] bg-[var(--color-accent-fill)] font-semibold text-[var(--color-on-accent)]">
        {isPending ? "Changing…" : "Change password"}
      </Button>
    </Form>
  );
}