"use client";

import { Button } from "react-aria-components";
import { signOut } from "@/features/auth/actions";

export function SignOutControl() {
  return (
    <form action={signOut}>
      <Button
        id="sign-out"
        type="submit"
        aria-label="Sign out"
        className="flex items-center justify-center text-control text-(--color-text-muted) data-[hovered]:text-(--color-text)">
        ⏻
      </Button>
    </form>
  );
}