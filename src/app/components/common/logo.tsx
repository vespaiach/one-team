import clsx from "clsx";

export default function Logo({ className }: { className?: string }) {
  return (
    <div className={clsx("flex items-center gap-2.5", className ?? "")}>
      <svg
        width="20"
        height="20"
        viewBox="0 0 32 32"
        aria-hidden="true"
        className="flex-none text-(--color-text)">
        <rect
          x="1"
          y="1"
          width="30"
          height="30"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        />
        <polygon
          points="7,10.3 12,6 16.3,6 16.3,26 12,26 12,11.4 9.1,13.5"
          fill="var(--color-accent)"
        />
        <rect
          x="20"
          y="6"
          width="4"
          height="20"
          fill="currentColor"
        />
      </svg>
      <span className="font-heading text-control font-extrabold tracking-[-0.01em] text-(--color-text)">
        One Team
      </span>
    </div>
  );
}