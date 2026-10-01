"use client";

import { Button } from "./hairline.ts";
import styles from "./LoadError.module.css";

export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={styles.error}>
      <p className={styles.message}>Couldn&apos;t load this.</p>
      <Button
        variant="secondary"
        onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}