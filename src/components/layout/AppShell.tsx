import type { ReactNode } from "react";
import { initials } from "../../lib/initials.ts";
import { NavLink } from "./NavLink.tsx";
import { SignOutButton } from "./SignOutButton.tsx";

type Props = {
  member: { fullName: string };
  children: ReactNode;
};

export function AppShell({ member, children }: Props) {
  return (
    <div className="flex min-h-screen bg-canvas font-text text-ink max-md:flex-col">
      <nav className="flex flex-[0_0_240px] flex-col gap-6 border-r border-hairline bg-surface-1 px-4 py-6 max-md:flex-none max-md:border-r-0 max-md:border-b">
        <p className="font-display text-body font-semibold text-ink">Tracklite</p>
        <NavLink href="/my-issues">My issues</NavLink>
        <div className="mt-auto flex min-w-0 flex-col items-start gap-2">
          <div className="flex w-full min-w-0 items-center gap-2">
            <span className="box-border flex size-8 flex-none items-center justify-center rounded-full border border-hairline-tertiary bg-surface-3 text-caption font-medium leading-none text-ink">
              {initials(member.fullName)}
            </span>
            <span
              className="min-w-0 truncate text-body-sm text-ink"
              title={member.fullName}>
              {member.fullName}
            </span>
          </div>
          <SignOutButton
            variant="tertiary"
            after="signIn"
          />
        </div>
      </nav>
      <main className="min-w-0 flex-1 p-8 max-md:p-4">{children}</main>
    </div>
  );
}