import Link from "next/link";

export function ForbiddenNotice() {
  return (
    <div className="flex flex-1 flex-col items-start gap-2 px-8 py-12">
      <p className="text-h2 text-(--color-text)">403</p>
      <p className="text-body text-(--color-text)">You don&apos;t have access to this.</p>
      <Link
        href="/home"
        className="text-body text-(--color-accent-text)">
        Home
      </Link>
    </div>
  );
}