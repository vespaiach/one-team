import type { Metadata } from "next";
import { SignInForm } from "@/features/auth/components/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const params = await searchParams;
  const showResetBanner = params.reset === "done";

  return (
    <>
      <h1 className="text-h4 mb-[6px]">Sign in</h1>
      {showResetBanner ? (
        <output className="mb-[24px] text-[13px] text-[var(--color-success)]">
          Your password has been changed. Sign in with it now.
        </output>
      ) : (
        <p className="mb-[24px] text-[13px] text-[color-mix(in_srgb,var(--color-text)_62%,transparent)]">
          Use the email your invitation was sent to.
        </p>
      )}
      <SignInForm />
    </>
  );
}