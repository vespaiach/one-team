import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityRow } from "./activity-row";

const ACTOR = { firstName: "Ada", lastName: "Lovelace" };

describe("ActivityRow (FR-028, FR-030, contracts/screens.md)", () => {
  it("renders 'created' as one sentence naming the actor", () => {
    render(
      <ActivityRow
        actor={ACTOR}
        type="created"
        field={null}
        fromValue={null}
        toValue={null}
      />,
    );

    expect(screen.getByText("Ada Lovelace created this")).not.toBeNull();
  });

  it("renders 'field_changed' naming the actor, the field and the from/to values", () => {
    render(
      <ActivityRow
        actor={ACTOR}
        type="field_changed"
        field="name"
        fromValue="Old"
        toValue="New"
      />,
    );

    expect(screen.getByText("Ada Lovelace changed name from Old to New")).not.toBeNull();
  });

  it("renders a null from_value or to_value as the literal string 'None'", () => {
    render(
      <ActivityRow
        actor={ACTOR}
        type="field_changed"
        field="assignee"
        fromValue={null}
        toValue="Grace Hopper"
      />,
    );

    expect(screen.getByText("Ada Lovelace changed assignee from None to Grace Hopper")).not.toBeNull();
  });

  it("renders 'member_added' naming the actor and the added member", () => {
    render(
      <ActivityRow
        actor={ACTOR}
        type="member_added"
        field={null}
        fromValue={null}
        toValue="Grace Hopper"
      />,
    );

    expect(screen.getByText("Ada Lovelace added Grace Hopper")).not.toBeNull();
  });

  it("renders 'member_removed' naming the actor and the removed member", () => {
    render(
      <ActivityRow
        actor={ACTOR}
        type="member_removed"
        field={null}
        fromValue="Grace Hopper"
        toValue={null}
      />,
    );

    expect(screen.getByText("Ada Lovelace removed Grace Hopper")).not.toBeNull();
  });

  it("renders 'archived' as one sentence naming the actor", () => {
    render(
      <ActivityRow
        actor={ACTOR}
        type="archived"
        field={null}
        fromValue={null}
        toValue={null}
      />,
    );

    expect(screen.getByText("Ada Lovelace archived this")).not.toBeNull();
  });

  it("renders 'reopened' as one sentence naming the actor", () => {
    render(
      <ActivityRow
        actor={ACTOR}
        type="reopened"
        field={null}
        fromValue={null}
        toValue={null}
      />,
    );

    expect(screen.getByText("Ada Lovelace reopened this")).not.toBeNull();
  });

  it("renders 'column_added' naming the actor and the new column", () => {
    render(
      <ActivityRow
        actor={ACTOR}
        type="column_added"
        field="Review"
        fromValue={null}
        toValue={null}
      />,
    );

    expect(screen.getByText("Ada Lovelace added column Review")).not.toBeNull();
  });

  it("renders 'column_renamed' naming the actor, the old name and the new name", () => {
    render(
      <ActivityRow
        actor={ACTOR}
        type="column_renamed"
        field="Todo"
        fromValue="Todo"
        toValue="Up next"
      />,
    );

    expect(screen.getByText("Ada Lovelace renamed column Todo to Up next")).not.toBeNull();
  });

  it("renders 'column_reordered' with a null to_value as a move to first", () => {
    render(
      <ActivityRow
        actor={ACTOR}
        type="column_reordered"
        field="Canceled"
        fromValue={null}
        toValue={null}
      />,
    );

    expect(screen.getByText("Ada Lovelace moved column Canceled to first")).not.toBeNull();
  });

  it("renders 'column_reordered' with a to_value as a move after that column", () => {
    render(
      <ActivityRow
        actor={ACTOR}
        type="column_reordered"
        field="Canceled"
        fromValue={null}
        toValue="Todo"
      />,
    );

    expect(screen.getByText("Ada Lovelace moved column Canceled after Todo")).not.toBeNull();
  });

  it("renders 'column_deleted' naming the actor and the deleted column", () => {
    render(
      <ActivityRow
        actor={ACTOR}
        type="column_deleted"
        field="Review"
        fromValue={null}
        toValue={null}
      />,
    );

    expect(screen.getByText("Ada Lovelace deleted column Review")).not.toBeNull();
  });

  it("carries no edit or delete control, of any type", () => {
    render(
      <ActivityRow
        actor={ACTOR}
        type="field_changed"
        field="name"
        fromValue="Old"
        toValue="New"
      />,
    );

    expect(screen.queryByRole("button", { name: /edit/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /delete/i })).toBeNull();
  });
});