"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { SignOutButton } from "../../../components/layout/SignOutButton.tsx";
import { Button, ButtonLink } from "../../../components/ui/hairline/index.ts";
import { useToast } from "../../../components/ui/Toast.tsx";
import { saveJson } from "../../../lib/save.ts";
import { StatusMessage } from "./StatusMessage.tsx";

type Initial = { state: "signIn" } | { state: "signedInAsOther"; fullName: string };
type View = Initial | { state: "expired" };
type Answer =
  | { outcome: "signedIn"; destination: string }
  | { outcome: "expired" }
  | { outcome: "signedInAsOther"; fullName: string };

const buttonId = "sign-in";

export function MagicLinkLanding({ token, initial }: { token: string; initial: Initial }) {
  const { showToast } = useToast();
  const requestId = useRef<string>(null);
  const [view, setView] = useState<View>(initial);
  const [pending, setPending] = useState(false);

  async function signIn() {
    requestId.current ??= crypto.randomUUID();
    setPending(true);
    const result = await saveJson<Answer>("/api/sessions", { token, requestId: requestId.current });
    if (!result.ok) {
      flushSync(() => setPending(false));
      showToast("Couldn't save. Try again.");
      document.getElementById(buttonId)?.focus();
      return;
    }
    const answer = result.data;
    if (answer.outcome === "signedIn") {
      window.location.assign(answer.destination);
      return;
    }
    setView(
      answer.outcome === "expired"
        ? { state: "expired" }
        : { state: "signedInAsOther", fullName: answer.fullName },
    );
  }

  return (
    <>
      <h1 className="mb-6 font-display text-headline text-ink">Sign in to Tracklite</h1>
      {view.state === "signIn" ? (
        <Button
          id={buttonId}
          isDisabled={pending}
          onPress={signIn}>
          Sign in
        </Button>
      ) : (
        <div className="flex flex-col items-start gap-4">
          {view.state === "expired" ? (
            <>
              <StatusMessage focusOnShow>This link has expired</StatusMessage>
              <ButtonLink
                variant="secondary"
                href="/sign-in">
                Request a new link
              </ButtonLink>
            </>
          ) : (
            <>
              <StatusMessage focusOnShow={view !== initial}>
                You're signed in as {view.fullName}. Sign out to use this sign-in link.
              </StatusMessage>
              <SignOutButton
                variant="secondary"
                after="reload"
              />
            </>
          )}
        </div>
      )}
    </>
  );
}