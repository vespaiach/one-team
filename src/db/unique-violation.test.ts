import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "./unique-violation";

describe("isUniqueViolation (F-2)", () => {
  it("recognises a raw error carrying code 23505", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
  });

  it("recognises 23505 wrapped in the postgres driver's error.cause", () => {
    const wrapped = new Error("duplicate key value violates unique constraint");
    wrapped.cause = { code: "23505" };
    expect(isUniqueViolation(wrapped)).toBe(true);
  });

  it("rejects a different error code", () => {
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
  });

  it("rejects an error whose cause carries a different code", () => {
    const wrapped = new Error("foreign key violation");
    wrapped.cause = { code: "23503" };
    expect(isUniqueViolation(wrapped)).toBe(false);
  });

  it("rejects null and non-object values", () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation("boom")).toBe(false);
  });
});