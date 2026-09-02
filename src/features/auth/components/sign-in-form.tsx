"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "react-aria-components/Button";
import { Form } from "react-aria-components/Form";
import { Banner } from "./banner";
import { CardFooterNote } from "./card-footer-note";
import { EmailField } from "./email-field";
import { validateEmail } from "./email-validation";
import { BanIcon, LockIcon, XCircleIcon } from "./icons";
import { PasswordField } from "./password-field";
import { primaryButtonClasses } from "./primary-button-classes";

type SignInResponse =
  | { result: "ok" }
  | { result: "rejected" }
  | { result: "deactivated"; contact: string | null }
  | { result: "throttled"; retryAfterSeconds: number };

type Outcome =
  | { kind: "rejected" }
  | { kind: "deactivated"; contact: string | null }
  | { kind: "throttled"; minutes: number }
  | null;

function validatePassword(value: string): string | null {
  if (value.length === 0) {
    return "Enter your password.";
  }
  return null;
}

export function SignInForm() {
  const router = useRouter();
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextEmailError = validateEmail(email);
    const nextPasswordError = validatePassword(password);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);

    if (nextEmailError) {
      emailRef.current?.focus();
      return;
    }
    if (nextPasswordError) {
      passwordRef.current?.focus();
      return;
    }

    setOutcome(null);
    setSubmitting(true);

    fetch("/api/auth/signin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password }),
    })
      .then((response) => response.json() as Promise<SignInResponse>)
      .then((body) => {
        if (body.result === "ok") {
          router.push("/home");
          return;
        }
        if (body.result === "rejected") {
          setOutcome({ kind: "rejected" });
          return;
        }
        if (body.result === "throttled") {
          const minutes = Math.ceil(body.retryAfterSeconds / 60);
          setOutcome({ kind: "throttled", minutes });
          return;
        }
        setOutcome({ kind: "deactivated", contact: body.contact });
      })
      .finally(() => {
        setSubmitting(false);
      });
  }

  const locked = outcome?.kind === "throttled";
  const rejected = outcome?.kind === "rejected";

  return (
    <Form
      validationBehavior="aria"
      onSubmit={handleSubmit}
      className="flex flex-col gap-[14px]">
      {outcome?.kind === "rejected" && (
        <Banner icon={XCircleIcon}>That email and password don&apos;t match.</Banner>
      )}
      {outcome?.kind === "deactivated" && (
        <Banner icon={BanIcon}>
          This account has been closed.{" "}
          {outcome.contact ? (
            <>
              Ask <b className="text-[var(--color-text)]">{outcome.contact}</b> to reopen it.
            </>
          ) : (
            "Contact your One Team administrator."
          )}
        </Banner>
      )}
      {outcome?.kind === "throttled" && (
        <Banner icon={LockIcon}>
          Too many attempts for this address. Sign-in is locked for another{" "}
          <b className="text-[var(--color-text)]">
            {outcome.minutes} minute{outcome.minutes === 1 ? "" : "s"}
          </b>
          .
        </Banner>
      )}

      <EmailField
        name="email"
        label="Email"
        placeholder="you@company.com"
        value={email}
        onChange={setEmail}
        onBlur={() => setEmailError(validateEmail(email))}
        isInvalid={emailError !== null || rejected}
        errorMessage={emailError ?? undefined}
        isDisabled={locked}
        inputRef={emailRef}
      />

      <PasswordField
        name="password"
        label="Password"
        placeholder="••••••••••••"
        labelExtra={
          <a
            href="/reset"
            className="text-[12px]">
            Forgot password?
          </a>
        }
        value={password}
        onChange={setPassword}
        onBlur={() => setPasswordError(validatePassword(password))}
        isInvalid={passwordError !== null || rejected}
        errorMessage={passwordError ?? undefined}
        isDisabled={locked}
        inputRef={passwordRef}
      />

      <Button
        type="submit"
        isDisabled={locked}
        className={`mt-[6px] ${primaryButtonClasses({ pending: submitting })}`}>
        {locked ? (
          `Locked for ${outcome.minutes} minute${outcome.minutes === 1 ? "" : "s"}`
        ) : submitting ? (
          <>
            <span
              aria-hidden="true"
              className="h-3 w-3 flex-none animate-spin rounded-full border-2 border-[color-mix(in_srgb,var(--color-bg)_40%,transparent)] border-t-[var(--color-bg)]"
            />
            Signing in…
          </>
        ) : (
          "Sign in"
        )}
      </Button>

      {locked && <CardFooterNote>A reset link still works while an address is locked.</CardFooterNote>}
    </Form>
  );
}