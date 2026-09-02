"use client";

import { useTransition } from "react";
import { Button } from "react-aria-components/Button";
import { requestOwnPasswordReset } from "@/features/auth/actions";
import { showToast } from "@/features/shell/components/toast-region";

function minutesRemaining(retryAfterSeconds: number): number {
  return Math.max(1, Math.ceil(retryAfterSeconds / 60));
}

function throttleMessage(retryAfterSeconds: number): string {
  const minutes = minutesRemaining(retryAfterSeconds);
  return `Too many requests. Try again in ${minutes} minute${minutes === 1 ? "" : "s"}.`;
}

export function ChangePasswordLink() {
  const [isPending, startTransition] = useTransition();

  function press() {
    startTransition(async () => {
      const result = await requestOwnPasswordReset();
      if (result.status === "throttled") {
        showToast({ kind: "error", message: throttleMessage(result.retryAfterSeconds) });
        return;
      }
      showToast({ kind: "success", message: "Check your email for a link to reset your password." });
    });
  }

  return (
    <Button
      onPress={press}
      isDisabled={isPending}
      className="text-control text-(--color-accent-text) underline underline-offset-[3px] data-disabled:cursor-not-allowed data-disabled:text-(--color-text-placeholder) data-disabled:no-underline">
      {isPending ? "Sending…" : "Change password"}
    </Button>
  );
}