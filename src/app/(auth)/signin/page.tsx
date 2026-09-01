import type { Metadata } from "next";
import { SignInForm } from "@/features/auth/components/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/signin">) {
  const params = await searchParams;
  const showResetBanner = params.reset === "done";

  return (
    <>
      <h1 className="text-h3">Sign in</h1>
      {showResetBanner && (
        <output className="text-[var(--color-success)]">
          Your password has been changed. Sign in with it now.
        </output>
      )}
      <SignInForm />
    </>
  );
}