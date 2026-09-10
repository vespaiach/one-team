import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityRow, activityActionPhrase } from "./activity-row";

describe("activityActionPhrase", () => {
  it("describes a field change with both sides", () => {
    expect(activityActionPhrase("field_changed", "priority", "Medium", "Urgent")).toBe(
      "changed priority from Medium to Urgent",
    );
  });

  it("falls back to None for a missing side", () => {
    expect(activityActionPhrase("field_changed", "assignee", null, "Ada Lovelace")).toBe(
      "changed assignee from None to Ada Lovelace",
    );
  });

  it("describes creation with no field", () => {
    expect(activityActionPhrase("created", null, null, null)).toBe("created this");
  });

  it("describes a column added by name", () => {
    expect(activityActionPhrase("column_added", "Backlog", null, null)).toBe("added column Backlog");
  });
});

describe("ActivityRow", () => {
  it("renders the actor name ahead of the action phrase", () => {
    render(
      <ActivityRow
        actor={{ firstName: "Ada", lastName: "Lovelace" }}
        type="archived"
        field={null}
        fromValue={null}
        toValue={null}
      />,
    );

    expect(screen.getByText("Ada Lovelace archived this")).toBeTruthy();
  });
});