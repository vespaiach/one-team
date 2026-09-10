import clsx from "clsx";

const VARIANT_CLASSES = {
  accent: "bg-(--color-accent-200) text-(--color-accent-900)",
  "accent-2": "bg-(--color-accent-2-200) text-(--color-accent-2-900)",
  neutral: "bg-(--color-neutral-200) text-(--color-neutral-900)",
} as const;

const SIZE_CLASSES = {
  sm: "h-4.5 w-4.5 text-[9px]",
  md: "h-7 w-7 text-[11px]",
} as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return "";
  }
  const first = parts[0] as string;
  const last = parts.length > 1 ? (parts[parts.length - 1] as string) : first;
  const secondChar = parts.length > 1 ? (last[0] ?? "") : (first[1] ?? "");
  return `${first[0] ?? ""}${secondChar}`.toUpperCase();
}

export function Avatar({
  name,
  avatarUrl,
  variant = "neutral",
  size = "md",
  decorative = false,
}: {
  name: string;
  avatarUrl: string | null;
  variant?: keyof typeof VARIANT_CLASSES;
  size?: keyof typeof SIZE_CLASSES;
  decorative?: boolean;
}) {
  if (avatarUrl !== null) {
    return (
      // biome-ignore lint/performance/noImgElement: avatarUrl is an arbitrary external URL, not an allow-listable domain for next/image
      <img
        src={avatarUrl}
        alt={decorative ? "" : name}
        aria-hidden={decorative ? "true" : undefined}
        className={clsx("flex-none rounded-full object-cover", SIZE_CLASSES[size])}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={clsx(
        "flex flex-none items-center justify-center rounded-full font-mono font-medium",
        SIZE_CLASSES[size],
        VARIANT_CLASSES[variant],
      )}>
      {initials(name)}
    </span>
  );
}