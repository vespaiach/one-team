"use client";

import { Button } from "../hairline/index.ts";

export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start gap-3">
      <p className="font-text text-body text-ink">Couldn&apos;t load this.</p>
      <Button
        variant="secondary"
        onPress={onRetry}>
        Retry
      </Button>
    </div>
  );
}