"use client";

import { Button } from "react-aria-components/Button";

export function CopyableKey({ issueKey }: { issueKey: string }) {
  function handlePress() {
    navigator.clipboard.writeText(window.location.href);
  }

  return (
    <Button
      onPress={handlePress}
      aria-label={`Copy link to ${issueKey}`}>
      {issueKey}
    </Button>
  );
}