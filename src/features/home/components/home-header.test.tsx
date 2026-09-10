import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { HomeHeader } from "./home-header";

describe("HomeHeader", () => {
  it("greets the viewer by first name according to the time of day", () => {
    render(
      <HomeHeader
        firstName="Ada"
        now={new Date("2026-09-07T08:00:00")}
      />,
    );

    expect(screen.getByRole("heading", { name: "Good morning, Ada" })).toBeTruthy();
  });

  it("shows the full date in mono", () => {
    render(
      <HomeHeader
        firstName="Ada"
        now={new Date("2026-09-07T08:00:00")}
      />,
    );

    expect(screen.getByText("Monday, 7 September 2026")).toBeTruthy();
  });
});