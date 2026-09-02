"use client";

import Link from "next/link";
import { useState } from "react";
import { SignOutControl } from "./sign-out-control";

export function UserChip({ displayName, avatarUrl }: { displayName: string; avatarUrl: string | null }) {
  const [avatarFailed, setAvatarFailed] = useState(false);
  const showAvatar = avatarUrl !== null && !avatarFailed;

  return (
    <div className="mt-auto flex items-center gap-2 border-t-2 border-(--color-border) px-4.5 pt-3">
      <Link
        href="/profile"
        aria-label={displayName}
        className="flex min-w-0 flex-1 items-center gap-2">
        {showAvatar ? (
          // biome-ignore lint/performance/noImgElement: avatarUrl is an arbitrary external URL, not an allow-listable domain for next/image
          <img
            src={avatarUrl}
            alt=""
            onError={() => setAvatarFailed(true)}
            className="h-7 w-7 flex-none object-cover"
          />
        ) : null}
        <span className="truncate text-control text-(--color-text)">{displayName}</span>
      </Link>
      <SignOutControl />
    </div>
  );
}