"use client";

import { useActionState, useEffect, useState } from "react";
import { Button } from "react-aria-components/Button";
import { Form } from "react-aria-components/Form";
import { type RequestPasswordResetState, requestPasswordReset } from "../actions";
import { BackToSignInFooter } from "./back-to-sign-in-footer";
import { EmailField } from "./email-field";
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
  const [cooldown, setCooldown] = useState<number | null>(null);

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
      <output className="flex flex-col gap-[6px]">
        <span className="mb-3 flex-none text-[var(--color-accent)]">
          <MailCheckIcon size={24} />
        </span>
        <h1 className="text-h4">Check your email</h1>
        <p className="mb-5 text-[13px] text-[color-mix(in_srgb,var(--color-text)_62%,transparent)]">
          If that address has an account, a link is on the way.
        </p>
        <div className="flex items-start gap-2 border border-[var(--color-divider)] bg-[var(--color-surface)] px-[14px] py-3 text-[13px] leading-[1.5]">
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
                className="text-[var(--color-accent-text)] underline underline-offset-[3px] data-[disabled]:cursor-not-allowed data-[disabled]:text-[color-mix(in_srgb,var(--color-text)_45%,transparent)] data-[disabled]:no-underline">
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
      validationBehavior="aria"
      className="flex flex-col gap-[14px]">
      <h1 className="text-h4 mb-[6px]">Reset your password</h1>
      <p className="mb-[10px] text-[13px] text-[color-mix(in_srgb,var(--color-text)_62%,transparent)]">
        We&rsquo;ll email a link that sets a new one.
      </p>
      <EmailField
        name="email"
        label="Email"
        placeholder="you@company.com"
        value={email}
        onChange={setEmail}
        isRequired
      />
      <Button
        type="submit"
        isDisabled={isPending}
        className={primaryButtonClasses({ pending: isPending })}>
        <MailIcon size={16} />
        {isPending ? "Sending…" : "Send reset link"}
      </Button>
      <BackToSignInFooter />
    </Form>
  );
}