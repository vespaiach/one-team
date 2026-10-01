import type { Metadata } from "next";
import Link from "next/link";
import { NotFoundFocus } from "./NotFoundFocus";

export const metadata: Metadata = {
  title: "Not found",
};

const headingId = "not-found-heading";

export default function NotFound() {
  return (
    <>
      <h1
        id={headingId}
        className="mb-4 font-display text-headline text-ink"
        tabIndex={-1}>
        Not found
      </h1>
      <NotFoundFocus headingId={headingId} />
      <Link
        href="/my-issues"
        className="text-body">
        My issues
      </Link>
    </>
  );
}