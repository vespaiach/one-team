"use client";

import { useState } from "react";

export function AvatarPreview({ avatarUrl, name }: { avatarUrl: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const showImage = avatarUrl !== null && !failed;

  if (!showImage) {
    return <p className="text-h5">{name}</p>;
  }

  return (
    // biome-ignore lint/performance/noImgElement: avatarUrl is an arbitrary external URL, not an allow-listable domain for next/image
    <img
      src={avatarUrl}
      alt=""
      onError={() => setFailed(true)}
      className="h-16 w-16 object-cover"
    />
  );
}