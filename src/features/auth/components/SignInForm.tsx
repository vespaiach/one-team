"use client";

import { type FormEvent, useState } from "react";
import { flushSync } from "react-dom";
import { FieldError } from "../../../components/ui/FieldError.tsx";
import { Button, TextInput } from "../../../components/ui/hairline/index.ts";
import { useToast } from "../../../components/ui/Toast.tsx";
import { sendSignInLinkRequest } from "../services/sendSignInLinkRequest.ts";
import { StatusMessage } from "./StatusMessage.tsx";

const fieldId = "email";
const buttonId = "send-sign-in-link";

export function SignInForm({ next }: { next?: string }) {
  const { showToast } = useToast();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [limited, setLimited] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    setLimited(false);
    const result = await sendSignInLinkRequest({ email, requestId: crypto.randomUUID(), next });
    if (result.kind === "checkEmail") {
      setSent(true);
      return;
    }
    flushSync(() => {
      setSending(false);
      setError(result.kind === "fields" ? result.fields.email : undefined);
      setLimited(result.kind === "limit");
    });
    if (result.kind === "fields") {
      document.getElementById(fieldId)?.focus();
      return;
    }
    if (result.kind === "limit") {
      document.getElementById(buttonId)?.focus();
      return;
    }
    showToast(
      result.kind === "sendFailed" ? "We couldn't send the email. Try again." : "Couldn't save. Try again.",
    );
    document.getElementById(buttonId)?.focus();
  }

  return (
    <>
      <h1 className="mb-6 font-display text-headline text-ink">Sign in to Tracklite</h1>
      {sent ? (
        <StatusMessage focusOnShow>Check your email</StatusMessage>
      ) : (
        <>
          <form
            noValidate
            onSubmit={submit}
            className="flex flex-col gap-4">
            <div>
              <TextInput
                id={fieldId}
                label="Email"
                type="email"
                value={email}
                onChange={setEmail}
                validationBehavior="aria"
                autoFocus
                isInvalid={Boolean(error)}
                aria-describedby={error ? `${fieldId}-error` : undefined}
              />
              {error ? (
                <FieldError
                  fieldId={fieldId}
                  message={error}
                />
              ) : null}
            </div>
            <Button
              id={buttonId}
              type="submit"
              isDisabled={sending}>
              Send sign-in link
            </Button>
          </form>
          <div role="status">
            {limited ? (
              <p className="mt-4 font-text text-body text-ink wrap-anywhere">
                Too many sign-in requests. Try again later.
              </p>
            ) : null}
          </div>
        </>
      )}
    </>
  );
}