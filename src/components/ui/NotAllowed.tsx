import Link from "next/link";
import { HeadingFocus } from "./HeadingFocus.tsx";

const headingId = "not-allowed-heading";

export function NotAllowed() {
  return (
    <>
      <h1
        id={headingId}
        className="mb-4 font-display text-headline text-ink"
        tabIndex={-1}>
        You don't have permission to do that.
      </h1>
      <HeadingFocus headingId={headingId} />
      <Link
        href="/my-issues"
        className="text-body">
        My issues
      </Link>
    </>
  );
}