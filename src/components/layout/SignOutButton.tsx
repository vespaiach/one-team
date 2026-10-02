"use client";

import { useState } from "react";
import { Button } from "../ui/hairline/index.ts";
import { useToast } from "../ui/Toast.tsx";

type Props = {
  variant: "secondary" | "tertiary";
  after: "signIn" | "reload";
};

async function endSession() {
  try {
    const response = await fetch("/api/sessions/current", { method: "DELETE" });
    return response.ok;
  } catch {
    return false;
  }
}

export function SignOutButton({ variant, after }: Props) {
  const { showToast } = useToast();
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    if (await endSession()) {
      if (after === "signIn") {
        window.location.assign("/sign-in");
      } else {
        window.location.reload();
      }
      return;
    }
    showToast("Couldn't save. Try again.");
    setPending(false);
  }

  return (
    <Button
      variant={variant}
      isPending={pending}
      onPress={signOut}>
      Sign out
    </Button>
  );
}