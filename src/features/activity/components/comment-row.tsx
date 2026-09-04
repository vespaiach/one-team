const RELATIVE_TIME_FORMAT = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

const RELATIVE_TIME_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
];

function formatRelativeTime(createdAt: Date, now: Date): string {
  const seconds = Math.round((createdAt.getTime() - now.getTime()) / 1000);
  for (const [unit, unitSeconds] of RELATIVE_TIME_UNITS) {
    if (Math.abs(seconds) >= unitSeconds) {
      return RELATIVE_TIME_FORMAT.format(Math.round(seconds / unitSeconds), unit);
    }
  }
  return RELATIVE_TIME_FORMAT.format(0, "minute");
}

export function CommentRow({
  id,
  actor,
  body,
  createdAt,
}: {
  id: string;
  actor: { firstName: string; lastName: string; avatarUrl: string | null };
  body: string;
  createdAt: Date;
}) {
  const displayName = `${actor.firstName} ${actor.lastName}`;

  return (
    <div
      id={`comment-${id}`}
      className="flex gap-3">
      {/* biome-ignore lint/performance/noImgElement: avatarUrl is an arbitrary external URL, not an allow-listable domain for next/image */}
      <img
        src={actor.avatarUrl ?? undefined}
        alt={displayName}
        width={32}
        height={32}
        className="h-8 w-8 flex-none object-cover"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <span className="text-control font-medium text-(--color-text)">{displayName}</span>
          <span className="text-label text-(--color-text-muted)">
            {formatRelativeTime(createdAt, new Date())}
          </span>
        </div>
        <p className="whitespace-pre-wrap text-control text-(--color-text)">{body}</p>
      </div>
    </div>
  );
}