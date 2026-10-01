function format(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).format(new Date(iso));
}

export function formatTime(iso: string, timeZone: string): string {
  try {
    return format(iso, timeZone);
  } catch (error) {
    if (error instanceof RangeError) {
      return format(iso, "UTC");
    }
    throw error;
  }
}