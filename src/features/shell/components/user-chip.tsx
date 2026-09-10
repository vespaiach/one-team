import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { SignOutControl } from "./sign-out-control";

export function UserChip({
  displayName,
  avatarUrl,
  current,
}: {
  displayName: string;
  avatarUrl: string | null;
  current: boolean;
}) {
  return (
    <div className="flex h-(--size-row) items-center gap-2 rounded-sm px-[7px] hover:bg-(--color-chrome-tint-strong)">
      <Link
        href="/profile"
        aria-current={current ? "page" : undefined}
        className="flex min-w-0 flex-1 items-center gap-2 text-[13px] no-underline">
        <Avatar
          name={displayName}
          avatarUrl={avatarUrl}
          size="sm"
          decorative
        />
        <span className="min-w-0 flex-1 truncate">{displayName}</span>
      </Link>
      <SignOutControl />
    </div>
  );
}