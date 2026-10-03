import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "../components/layout/AppShell.tsx";
import { HeadingFocus } from "../components/ui/HeadingFocus.tsx";
import { requireCurrentMember } from "../server/session.ts";

export const metadata: Metadata = {
  title: "Not found",
};

const headingId = "not-found-heading";

export default async function NotFound() {
  const member = await requireCurrentMember();
  return (
    <AppShell member={{ fullName: member.fullName }}>
      <h1
        id={headingId}
        className="mb-4 font-display text-headline text-ink"
        tabIndex={-1}>
        Not found
      </h1>
      <HeadingFocus headingId={headingId} />
      <Link
        href="/my-issues"
        className="text-body">
        My issues
      </Link>
    </AppShell>
  );
}