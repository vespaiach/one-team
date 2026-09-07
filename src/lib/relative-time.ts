const RELATIVE_TIME_FORMAT = new Intl.RelativeTimeFormat("en-US", { numeric: "auto" });

const RELATIVE_TIME_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
];

export function formatRelativeTime(createdAt: Date, now: Date): string {
  const seconds = Math.round((createdAt.getTime() - now.getTime()) / 1000);
  for (const [unit, unitSeconds] of RELATIVE_TIME_UNITS) {
    if (Math.abs(seconds) >= unitSeconds) {
      return RELATIVE_TIME_FORMAT.format(Math.round(seconds / unitSeconds), unit);
    }
  }
  return RELATIVE_TIME_FORMAT.format(0, "minute");
}