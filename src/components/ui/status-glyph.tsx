export type ColumnKind = "open" | "done" | "canceled";

const KIND_LABELS: Record<ColumnKind, string> = {
  open: "Open",
  done: "Done",
  canceled: "Canceled",
};

export function StatusGlyph({ kind }: { kind: ColumnKind }) {
  const label = KIND_LABELS[kind];

  if (kind === "done") {
    return (
      <span
        role="img"
        aria-label={label}
        className="grid h-3.5 w-3.5 flex-none place-items-center rounded-full bg-(--color-accent-600)">
        <span className="h-[3.5px] w-[6px] flex-none translate-y-[-1px] rotate-[-45deg] border-(--color-on-accent) border-b-[1.5px] border-l-[1.5px]" />
      </span>
    );
  }

  if (kind === "canceled") {
    return (
      <span
        role="img"
        aria-label={label}
        className="relative grid h-3.5 w-3.5 flex-none place-items-center rounded-full border-[1.5px] border-(--color-text-disabled)">
        <span className="absolute h-[1.5px] w-2 bg-(--color-text-disabled)" />
      </span>
    );
  }

  return (
    <span
      role="img"
      aria-label={label}
      className="h-3.5 w-3.5 flex-none rounded-full border-[1.5px] border-(--color-neutral-700)"
    />
  );
}