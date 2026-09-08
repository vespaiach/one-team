"use client";

import { useEffect } from "react";
import { Link } from "react-aria-components/Link";
import { BackToSignInFooter } from "@/features/auth/components/back-to-sign-in-footer";
import { Banner } from "@/features/auth/components/banner";
import { RefreshCwIcon, XCircleIcon } from "@/features/auth/components/icons";
import { primaryButtonClasses } from "@/features/auth/components/primary-button-classes";

export default function AuthError({ error }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col gap-[14px]">
      <h1 className="text-h1">Something went wrong</h1>
      <Banner icon={XCircleIcon}>Try the link again, or request a new one below.</Banner>
      <Link
        href="/reset"
        className={`mt-[6px] no-underline ${primaryButtonClasses()}`}>
        <RefreshCwIcon size={16} />
        Request a new link
      </Link>
      <BackToSignInFooter />
    </div>
  );
}