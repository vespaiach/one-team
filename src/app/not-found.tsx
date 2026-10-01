import type { Metadata } from "next";
import Link from "next/link";
import { NotFoundFocus } from "./NotFoundFocus";
import styles from "./not-found.module.css";

export const metadata: Metadata = {
  title: "Not found",
};

const headingId = "not-found-heading";

export default function NotFound() {
  return (
    <>
      <h1
        id={headingId}
        className={styles.heading}
        tabIndex={-1}>
        Not found
      </h1>
      <NotFoundFocus headingId={headingId} />
      <Link
        href="/my-issues"
        className={styles.link}>
        My issues
      </Link>
    </>
  );
}