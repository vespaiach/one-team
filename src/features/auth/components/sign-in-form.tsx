"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Button } from "react-aria-components/Button";
import { FieldError } from "react-aria-components/FieldError";
import { Form } from "react-aria-components/Form";
import { Input } from "react-aria-components/Input";
import { Label } from "react-aria-components/Label";
import { TextField } from "react-aria-components/TextField";

type SignInResponse =
  | { result: "ok" }
  | { result: "rejected" }
  | { result: "deactivated"; contact: string | null }
  | { result: "throttled"; retryAfterSeconds: number };

type Outcome = { message: string } | null;

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateEmail(value: string): string | null {
  if (value.length === 0) {
    return "Enter your email address.";
  }
  if (!EMAIL_SHAPE.test(value)) {
    return "Enter a valid email address.";
  }
  return null;
}

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
          setOutcome({ message: "That email and password don't match." });
          return;
        }
        if (body.result === "throttled") {
          const minutes = Math.ceil(body.retryAfterSeconds / 60);
          setOutcome({
            message: `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
          });
          return;
        }
        setOutcome({
          message: `This account has been deactivated. Contact ${body.contact ?? "your One Team administrator"}.`,
        });
      })
      .finally(() => {
        setSubmitting(false);
      });
  }

  return (
    <Form
      validationBehavior="aria"
      onSubmit={handleSubmit}
      className="flex flex-col gap-6">
      <TextField
        name="email"
        type="email"
        value={email}
        onChange={setEmail}
        isInvalid={emailError !== null}
        onBlur={() => setEmailError(validateEmail(email))}
        className="flex flex-col gap-1.5">
        <Label className="text-small font-medium text-[var(--color-text)]">Email</Label>
        <Input
          ref={emailRef}
          className="h-[var(--size-field)] border border-[var(--color-border-control)] bg-[var(--color-surface)] px-3 text-control text-[var(--color-text)] data-[invalid]:border-[var(--color-danger)]"
        />
        <FieldError className="text-small text-[var(--color-danger)]">{emailError}</FieldError>
      </TextField>

      <TextField
        name="password"
        type="password"
        value={password}
        onChange={setPassword}
        isInvalid={passwordError !== null}
        onBlur={() => setPasswordError(validatePassword(password))}
        className="flex flex-col gap-1.5">
        <Label className="text-small font-medium text-[var(--color-text)]">Password</Label>
        <Input
          ref={passwordRef}
          className="h-[var(--size-field)] border border-[var(--color-border-control)] bg-[var(--color-surface)] px-3 text-control text-[var(--color-text)] data-[invalid]:border-[var(--color-danger)]"
        />
        <FieldError className="text-small text-[var(--color-danger)]">{passwordError}</FieldError>
      </TextField>

      {outcome && (
        <div
          role="alert"
          className="break-words text-small text-[var(--color-danger)]">
          {outcome.message}
        </div>
      )}

      <Button
        type="submit"
        className="h-[var(--size-field)] bg-[var(--color-accent)] font-medium text-white data-[hovered]:bg-[var(--color-accent-hover)] data-[pressed]:bg-[var(--color-accent-pressed)]">
        {submitting ? "Signing in…" : "Sign in"}
      </Button>

      <a
        href="/reset"
        className="text-small text-[var(--color-accent-text)]">
        Forgot password?
      </a>
    </Form>
  );
}