"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "react-aria-components/Button";
import { Form } from "react-aria-components/Form";
import Logo from "@/app/components/common/logo";
import { type RequestPasswordResetState, requestPasswordReset } from "../actions";
import { BackToSignInFooter } from "./back-to-sign-in-footer";
import { EmailField } from "./email-field";
import { validateEmail } from "./email-validation";
import { InfoIcon, MailCheckIcon, MailIcon } from "./icons";
import { primaryButtonClasses } from "./primary-button-classes";

const INITIAL_STATE: RequestPasswordResetState = { status: "idle" };

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function ResetRequestForm() {
  const [state, formAction, isPending] = useActionState(requestPasswordReset, INITIAL_STATE);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState<number | null>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const nextEmailError = validateEmail(email);
    setEmailError(nextEmailError);

    if (nextEmailError) {
      event.preventDefault();
      emailRef.current?.focus();
    }
  }

  useEffect(() => {
    if (state.status === "throttled") {
      setCooldown(state.retryAfterSeconds);
    }
  }, [state]);

  useEffect(() => {
    if (cooldown === null || cooldown <= 0) {
      return;
    }
    const id = setInterval(() => {
      setCooldown((current) => (current !== null ? Math.max(0, current - 1) : current));
    }, 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  if (state.status === "sent" || state.status === "throttled") {
    const waiting = cooldown !== null && cooldown > 0;

    return (
      <output className="flex flex-col gap-1.5">
        <span className="mb-3 flex-none text-(--color-accent)">
          <MailCheckIcon size={24} />
        </span>
        <h1 className="text-h4">Check your email</h1>
        <p className="mb-5 text-[13px] text-[color-mix(in_srgb,var(--color-text)_62%,transparent)]">
          If that address has an account, a link is on the way.
        </p>
        <div className="flex items-start gap-2 border border-(--color-divider) bg-(--color-surface) px-3.5 py-3 text-[13px] leading-normal">
          <span className="mt-px flex-none text-[color-mix(in_srgb,var(--color-text)_62%,transparent)]">
            <InfoIcon size={16} />
          </span>
          <span>
            Nothing after a few minutes? Check spam, or{" "}
            <form
              action={formAction}
              className="inline">
              <input
                type="hidden"
                name="email"
                value={email}
              />
              <Button
                type="submit"
                isDisabled={waiting}
                className="text-(--color-accent-text) underline underline-offset-[3px] data-disabled:cursor-not-allowed data-disabled:text-[color-mix(in_srgb,var(--color-text)_45%,transparent)] data-[disabled]:no-underline">
                request another
              </Button>
            </form>
            {waiting && cooldown !== null && <> — you can try again in {formatCountdown(cooldown)}.</>}
          </span>
        </div>
        <BackToSignInFooter />
      </output>
    );
  }

  return (
    <Form
      action={formAction}
      onSubmit={handleSubmit}
      validationBehavior="aria"
      className="flex flex-col gap-5">
      <Logo className="mb-2" />
      <div>
        <h1 className="text-h4">Reset your password</h1>
        <p className="text-[13px] text-[color-mix(in_srgb,var(--color-text)_62%,transparent)]">
          We&rsquo;ll email a link that sets a new one.
        </p>
      </div>
      <div>
        <EmailField
          name="email"
          label="Email"
          placeholder="you@company.com"
          value={email}
          onChange={setEmail}
          onBlur={() => setEmailError(validateEmail(email))}
          isInvalid={emailError !== null}
          errorMessage={emailError ?? undefined}
          isRequired
          inputRef={emailRef}
        />
        <Button
          type="submit"
          isDisabled={isPending}
          className={primaryButtonClasses({ pending: isPending, className: "mt-4" })}>
          <MailIcon size={16} />
          {isPending ? "Sending…" : "Send reset link"}
        </Button>
        <BackToSignInFooter />
      </div>
    </Form>
  );
}