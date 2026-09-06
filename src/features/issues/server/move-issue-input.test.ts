import { describe, expect, it } from "vitest";
import * as moveIssueInput from "./move-issue-input";
import { parseGrouping, parseIssueId } from "./move-issue-input";

const WELL_FORMED_UUID = "0199a5c1-6f3e-7c2a-9b41-8d5e2f0a7c34";

describe("parseGrouping (FR-034, FR-035, Principle II)", () => {
  it.each(["column", "assignee", "priority"])("accepts %s and returns it unchanged", (value) => {
    expect(parseGrouping(value)).toBe(value);
  });

  it("refuses a fourth value outside the three, without defaulting to column", () => {
    expect(parseGrouping("status")).toBeNull();
    expect(parseGrouping("label")).toBeNull();
  });

  it("refuses a value differing only in case, without coercing it", () => {
    expect(parseGrouping("Column")).toBeNull();
    expect(parseGrouping("PRIORITY")).toBeNull();
  });

  it("refuses a value with surrounding whitespace, without trimming it", () => {
    expect(parseGrouping(" column ")).toBeNull();
  });

  it("refuses an empty string", () => {
    expect(parseGrouping("")).toBeNull();
  });

  it("refuses a non-string value", () => {
    expect(parseGrouping(undefined)).toBeNull();
    expect(parseGrouping(null)).toBeNull();
    expect(parseGrouping(0)).toBeNull();
    expect(parseGrouping(["column"])).toBeNull();
    expect(parseGrouping({ grouping: "column" })).toBeNull();
  });
});

describe("parseIssueId (OT-UX-004, Principle II)", () => {
  it("accepts a well-formed UUID and returns it unchanged", () => {
    expect(parseIssueId(WELL_FORMED_UUID)).toBe(WELL_FORMED_UUID);
  });

  it("refuses an empty string", () => {
    expect(parseIssueId("")).toBeNull();
  });

  it("refuses a value that is not a UUID at all", () => {
    expect(parseIssueId("abc")).toBeNull();
  });

  it("refuses a UUID with a trailing character", () => {
    expect(parseIssueId(`${WELL_FORMED_UUID}a`)).toBeNull();
  });

  it("refuses a UUID missing its last character", () => {
    expect(parseIssueId(WELL_FORMED_UUID.slice(0, -1))).toBeNull();
  });

  it("refuses a UUID with surrounding whitespace, without trimming it", () => {
    expect(parseIssueId(` ${WELL_FORMED_UUID} `)).toBeNull();
  });

  it("refuses a non-string value", () => {
    expect(parseIssueId(undefined)).toBeNull();
    expect(parseIssueId(null)).toBeNull();
    expect(parseIssueId(42)).toBeNull();
    expect(parseIssueId([WELL_FORMED_UUID])).toBeNull();
    expect(parseIssueId({ id: WELL_FORMED_UUID })).toBeNull();
  });
});

describe("the module's surface", () => {
  it("exports parseGrouping and parseIssueId and nothing else", () => {
    expect(Object.keys(moveIssueInput).sort()).toEqual(["parseGrouping", "parseIssueId"]);
  });

  it("re-exports no parser of its own for placement, which is R9's", () => {
    expect(moveIssueInput).not.toHaveProperty("parsePlacement");
  });
});