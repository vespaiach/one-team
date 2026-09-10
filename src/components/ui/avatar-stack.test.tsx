import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AvatarStack } from "./avatar-stack";

const PEOPLE = [
  { id: "1", name: "Ada Lovelace", avatarUrl: null },
  { id: "2", name: "Grace Hopper", avatarUrl: null },
  { id: "3", name: "Alan Turing", avatarUrl: null },
  { id: "4", name: "Katherine Johnson", avatarUrl: null },
];

describe("AvatarStack", () => {
  it("renders every person when under the limit", () => {
    render(
      <AvatarStack
        people={PEOPLE.slice(0, 2)}
        limit={3}
      />,
    );

    expect(screen.getByText("AL")).toBeTruthy();
    expect(screen.getByText("GH")).toBeTruthy();
    expect(screen.queryByText(/\+/)).toBeNull();
  });

  it("caps the shown avatars and labels the rest as an overflow count", () => {
    render(
      <AvatarStack
        people={PEOPLE}
        limit={3}
      />,
    );

    expect(screen.getByText("+1")).toBeTruthy();
  });
});