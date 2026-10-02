import type { Metadata } from "next";
import { EmptyState } from "../../../components/ui/EmptyState.tsx";
import { HeadingFocus } from "../../../components/ui/HeadingFocus.tsx";

export const metadata: Metadata = {
  title: "My issues",
};

const headingId = "my-issues-heading";

export default function MyIssuesPage() {
  return (
    <>
      <h1
        id={headingId}
        className="mb-4 font-display text-headline text-ink"
        tabIndex={-1}>
        My issues
      </h1>
      <HeadingFocus headingId={headingId} />
      <EmptyState message="Nothing assigned to you" />
    </>
  );
}