function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="grid gap-0.5">
      <span className="font-serif font-semibold text-(--color-accent) text-[26px] leading-none tracking-[-0.02em] tabular-nums">
        {value}
      </span>
      <span className="text-[10.5px] font-medium text-(--color-text-muted) uppercase tracking-[0.1em]">
        {label}
      </span>
    </div>
  );
}

export function MetricStrip({
  assignedCount,
  dueThisWeekCount,
  teamOpenCount,
}: {
  assignedCount: number;
  dueThisWeekCount: number;
  teamOpenCount: number;
}) {
  return (
    <div className="flex shrink-0 gap-8 border-b border-(--color-divider) p-3">
      <Metric
        value={assignedCount}
        label="Assigned to you"
      />
      <Metric
        value={dueThisWeekCount}
        label="Due this week"
      />
      <Metric
        value={teamOpenCount}
        label="Open · whole team"
      />
    </div>
  );
}