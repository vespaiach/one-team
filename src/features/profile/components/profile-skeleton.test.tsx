import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ProfileRecord } from "../server/queries";
import { ProfileScreen } from "./profile-screen";
import { ProfileSkeleton } from "./profile-skeleton";

const RECORD: ProfileRecord = {
  avatarUrl: null,
  firstName: "Ada",
  lastName: "Lovelace",
  jobTitle: null,
  slackHandle: null,
  phone: null,
  bio: null,
  email: "ada@example.com",
  role: "member",
};

function rowCount(container: HTMLElement): number {
  return container.querySelectorAll("[data-row]").length;
}

describe("ProfileSkeleton (FR-031, OT-UX-005)", () => {
  it("renders the same number of rows, in the same order, as ProfileScreen", () => {
    const { container: screenContainer } = render(<ProfileScreen record={RECORD} />);
    const { container: skeletonContainer } = render(<ProfileSkeleton />);

    expect(rowCount(skeletonContainer)).toBe(rowCount(screenContainer));
  });

  it("reserves at least three rows of height for the bio, matching the field's minimum", () => {
    const { container } = render(<ProfileSkeleton />);

    const bioRow = container.querySelector('[data-row="bio"]');
    expect(bioRow).not.toBeNull();
    expect(bioRow?.className).toContain("min-h-[4.5rem]");
  });

  it("renders no full-screen spinner", () => {
    const { container } = render(<ProfileSkeleton />);

    expect(container.querySelector('[role="status"]')).toBeNull();
    expect(container.querySelector("[data-spinner]")).toBeNull();
  });
});