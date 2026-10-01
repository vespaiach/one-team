import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocalTime } from "./LocalTime.tsx";

const iso = "2026-09-30T02:00:00Z";

describe("LocalTime", () => {
  const originalTz = process.env.TZ;

  beforeEach(() => {
    process.env.TZ = "Asia/Bangkok";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.TZ = originalTz;
  });

  it("shows HH:mm in the browser's zone with no zone label", () => {
    expect(Intl.DateTimeFormat().resolvedOptions().timeZone).toBe("Asia/Bangkok");
    const { container } = render(<LocalTime iso={iso} />);
    const time = container.querySelector("time");
    expect(time).not.toBeNull();
    expect(time?.getAttribute("dateTime")).toBe(iso);
    expect(time?.textContent).toBe("09:00");
  });

  it("shows the UTC time when the browser's resolved zone is undefined", () => {
    const resolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(function (
      this: Intl.DateTimeFormat,
    ) {
      return { ...resolvedOptions.call(this), timeZone: undefined as unknown as string };
    });
    const { container } = render(<LocalTime iso={iso} />);
    const time = container.querySelector("time");
    expect(time?.getAttribute("dateTime")).toBe(iso);
    expect(time?.textContent).toBe("02:00");
  });
});