import { describe, expect, it } from "vitest";
import { formatRelativeTime } from "./relative-time";

const NOW = new Date("2026-06-15T12:00:00.000Z");

function ago(seconds: number): Date {
  return new Date(NOW.getTime() - seconds * 1000);
}

function ahead(seconds: number): Date {
  return new Date(NOW.getTime() + seconds * 1000);
}

describe("formatRelativeTime (C-4, FR-024, FR-030)", () => {
  it("reads anything under a minute as this minute", () => {
    expect(formatRelativeTime(ago(0), NOW)).toBe("this minute");
    expect(formatRelativeTime(ago(59), NOW)).toBe("this minute");
    expect(formatRelativeTime(ahead(59), NOW)).toBe("this minute");
  });

  it("climbs the minute, hour, day, month and year rungs in that order", () => {
    expect(formatRelativeTime(ago(60), NOW)).toBe("1 minute ago");
    expect(formatRelativeTime(ago(45 * 60), NOW)).toBe("45 minutes ago");
    expect(formatRelativeTime(ago(60 * 60), NOW)).toBe("1 hour ago");
    expect(formatRelativeTime(ago(5 * 60 * 60), NOW)).toBe("5 hours ago");
    expect(formatRelativeTime(ago(24 * 60 * 60), NOW)).toBe("yesterday");
    expect(formatRelativeTime(ago(3 * 24 * 60 * 60), NOW)).toBe("3 days ago");
    expect(formatRelativeTime(ago(30 * 24 * 60 * 60), NOW)).toBe("last month");
    expect(formatRelativeTime(ago(90 * 24 * 60 * 60), NOW)).toBe("3 months ago");
    expect(formatRelativeTime(ago(365 * 24 * 60 * 60), NOW)).toBe("last year");
    expect(formatRelativeTime(ago(2 * 365 * 24 * 60 * 60), NOW)).toBe("2 years ago");
  });

  it("formats an instant ahead of now in the future direction", () => {
    expect(formatRelativeTime(ahead(60), NOW)).toBe("in 1 minute");
    expect(formatRelativeTime(ahead(24 * 60 * 60), NOW)).toBe("tomorrow");
    expect(formatRelativeTime(ahead(365 * 24 * 60 * 60), NOW)).toBe("next year");
  });

  it("rounds to the nearest whole unit on the rung it lands on", () => {
    expect(formatRelativeTime(ago(90), NOW)).toBe("1 minute ago");
    expect(formatRelativeTime(ago(100), NOW)).toBe("2 minutes ago");
    expect(formatRelativeTime(ago(400 * 24 * 60 * 60), NOW)).toBe("last year");
  });
});