import { describe, expect, it } from "vitest";
import Home from "./page";

describe("/ (research B-6)", () => {
  it("redirects to /home", () => {
    expect(() => Home()).toThrow(
      expect.objectContaining({ digest: expect.stringContaining(";/home;") as string }),
    );
  });
});