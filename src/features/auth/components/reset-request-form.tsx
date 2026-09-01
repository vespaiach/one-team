"use client";

import { useActionState } from "react";
import { Button } from "react-aria-components/Button";
import { Form } from "react-aria-components/Form";
import { FieldError, Input, Label, TextField } from "react-aria-components/TextField";
import { type RequestPasswordResetState, requestPasswordReset } from "../actions";

const INITIAL_STATE: RequestPasswordResetState = { status: "idle" };

export function ResetRequestForm() {
  const [state, formAction, isPending] = useActionState(requestPasswordReset, INITIAL_STATE);

  if (state.status === "sent") {
    return (
      <output className="flex flex-col gap-2 border-t-2 border-[var(--color-border-strong)] bg-[var(--color-surface-sunken)] p-4">
        <p className="font-semibold">Check your email</p>
        <p>If that address has an account, a link is on the way</p>
      </output>
    );
  }

  if (state.status === "throttled") {
    const minutes = Math.ceil(state.retryAfterSeconds / 60);
    return (
      <div
        role="alert"
        className="flex flex-col gap-2 border-t-2 border-[var(--color-border-strong)] bg-[var(--color-surface-sunken)] p-4">
        <p className="font-semibold">Too many requests</p>
        <p>
          Try again in {minutes} minute{minutes === 1 ? "" : "s"}.
        </p>
      </div>
    );
  }

  return (
    <Form
      action={formAction}
      validationBehavior="aria"
      className="flex flex-col gap-6">
      <p className="text-label text-[var(--color-text-muted)]">
        We&rsquo;ll email a link that sets a new one.
      </p>
      <TextField
        name="email"
        type="email"
        isRequired
        className="flex flex-col gap-2">
        <Label>Email</Label>
        <Input className="h-[var(--size-field)] border border-[var(--color-border-control)] px-3" />
        <FieldError className="text-label text-[var(--color-danger-text)]" />
      </TextField>
      <Button
        type="submit"
        isDisabled={isPending}
        className="h-[var(--size-field)] bg-[var(--color-accent-fill)] font-semibold text-[var(--color-on-accent)]">
        {isPending ? "Sending…" : "Send reset link"}
      </Button>
    </Form>
  );
}