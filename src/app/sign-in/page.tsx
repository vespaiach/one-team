import type { Metadata } from "next";
import { MagicLinkLanding } from "../../features/auth/components/MagicLinkLanding.tsx";
import { SignInForm } from "../../features/auth/components/SignInForm.tsx";
import { db } from "../../server/db.ts";
import { currentMember } from "../../server/session.ts";
import { landingState } from "../../server/signIn.ts";

export const metadata: Metadata = {
  title: "Sign in",
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = first(params.token);
  if (token === undefined) {
    return <SignInForm next={first(params.next)} />;
  }
  const initial = await landingState(db(), { token, member: await currentMember() });
  return (
    <MagicLinkLanding
      token={token}
      initial={initial}
    />
  );
}