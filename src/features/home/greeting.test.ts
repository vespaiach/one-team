import { describe, expect, it } from "vitest";
import { greetingForHour } from "./greeting";

describe("greetingForHour", () => {
  it("greets morning before noon", () => {
    expect(greetingForHour(0)).toBe("Good morning");
    expect(greetingForHour(11)).toBe("Good morning");
  });

  it("greets afternoon from noon to before 6pm", () => {
    expect(greetingForHour(12)).toBe("Good afternoon");
    expect(greetingForHour(17)).toBe("Good afternoon");
  });

  it("greets evening from 6pm onward", () => {
    expect(greetingForHour(18)).toBe("Good evening");
    expect(greetingForHour(23)).toBe("Good evening");
  });
});