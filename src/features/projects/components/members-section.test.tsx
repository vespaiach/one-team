import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { RosterEntry } from "../server/queries";
import { MembersSection } from "./members-section";

const ROSTER: RosterEntry[] = [
  { userId: "1", displayName: "Ada Lovelace", avatarUrl: null, jobTitle: "Engineer", deactivated: false },
  { userId: "2", displayName: "Grace Hopper", avatarUrl: null, jobTitle: null, deactivated: true },
];

describe("MembersSection (FR-018, FR-045)", () => {
  it("lists membership rows only", () => {
    render(<MembersSection roster={ROSTER} />);

    expect(screen.getByText("Ada Lovelace")).not.toBeNull();
    expect(screen.getByText("Grace Hopper")).not.toBeNull();
  });

  it("keeps a deactivated member's row present", () => {
    render(<MembersSection roster={ROSTER} />);

    const rows = screen.getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual(
      expect.arrayContaining([expect.stringContaining("Grace Hopper") as string]),
    );
  });
});