import type { Metadata } from "next";
import { SignInForm } from "@/features/auth/components/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const params = await searchParams;
  const showResetBanner = params.reset === "done";

  return (
    <>
      <div>
        <h1 className="text-h1 mb-2">Sign in</h1>
        {showResetBanner ? (
          <output className="text-[13px] text-(--color-success)">
            Your password has been changed. Sign in with it now.
          </output>
        ) : (
          <p className="text-[13px] text-[color-mix(in_srgb,var(--color-text)_62%,transparent)]">
            Use the email your invitation was sent to.
          </p>
        )}
      </div>
      <SignInForm />
    </>
  );
}