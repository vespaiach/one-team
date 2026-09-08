"use client";

import { useState } from "react";

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "";
  }
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function AvatarPreview({ avatarUrl, name }: { avatarUrl: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const showImage = avatarUrl !== null && !failed;

  if (!showImage) {
    return (
      <p className="flex h-16 w-16 items-center justify-center rounded-full bg-(--color-accent-200) font-mono text-h5 text-(--color-accent-900)">
        <span className="sr-only">{name}</span>
        <span aria-hidden="true">{initialsOf(name)}</span>
      </p>
    );
  }

  return (
    // biome-ignore lint/performance/noImgElement: avatarUrl is an arbitrary external URL, not an allow-listable domain for next/image
    <img
      src={avatarUrl}
      alt=""
      onError={() => setFailed(true)}
      className="h-16 w-16 rounded-full object-cover"
    />
  );
}