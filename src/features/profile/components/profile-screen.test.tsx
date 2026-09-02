import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ProfileRecord } from "../server/queries";
import { ProfileScreen } from "./profile-screen";

vi.mock("../actions", () => ({
  updateOwnProfile: vi.fn(() => new Promise(() => undefined)),
}));

vi.mock("@/features/shell/messages", () => ({
  raiseMessage: vi.fn(),
}));

vi.mock("@/features/auth/actions", () => ({
  requestOwnPasswordReset: vi.fn(() => new Promise(() => undefined)),
}));

const FULL_RECORD: ProfileRecord = {
  avatarUrl: "https://example.com/a.png",
  firstName: "Ada",
  lastName: "Lovelace",
  jobTitle: "Engineer",
  slackHandle: "@ada",
  phone: "+1 555 0100",
  bio: "Line one\nLine two",
  email: "ada@example.com",
  role: "admin",
};

const EMPTY_RECORD: ProfileRecord = {
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

describe("ProfileScreen — the nine values, in order (FR-006, FR-009, FR-012b)", () => {
  it("renders the seven editable labels then the two shown labels, in that order", () => {
    render(<ProfileScreen record={FULL_RECORD} />);

    const labels = ["Avatar", "First name", "Last name", "Job title", "Slack handle", "Phone", "Bio"];
    const positions = labels.map((label) => screen.getByRole("button", { name: label }));
    for (let i = 1; i < positions.length; i += 1) {
      const previous = positions[i - 1];
      const current = positions[i];
      expect(previous.compareDocumentPosition(current) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    }

    const email = screen.getByRole("group", { name: "Email" });
    const role = screen.getByRole("group", { name: "Account role" });
    const lastEditable = positions[positions.length - 1];
    expect(lastEditable.compareDocumentPosition(email) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(email.compareDocumentPosition(role) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it("shows the avatar as a URL text field, never an upload control", () => {
    render(<ProfileScreen record={FULL_RECORD} />);

    fireEvent.click(screen.getByRole("button", { name: "Avatar" }));
    expect(screen.getByRole("textbox", { name: "Avatar" })).not.toBeNull();
    expect(document.querySelector('input[type="file"]')).toBeNull();
  });

  it("shows the four placeholder lines verbatim for a record with unset optional fields", () => {
    render(<ProfileScreen record={EMPTY_RECORD} />);

    expect(screen.getByRole("button", { name: "Job title" }).textContent).toBe("Add a job title");
    expect(screen.getByRole("button", { name: "Slack handle" }).textContent).toBe("Add a Slack handle");
    expect(screen.getByRole("button", { name: "Phone" }).textContent).toBe("Add a phone number");
    expect(screen.getByRole("button", { name: "Bio" }).textContent).toBe("Add a bio");
  });

  it("renders the display name alone, with no image, when the avatar is unset", () => {
    render(<ProfileScreen record={EMPTY_RECORD} />);

    expect(screen.getByText("Ada Lovelace")).not.toBeNull();
    expect(document.querySelector("img")).toBeNull();
  });

  it("falls back to the display name alone, with no broken-image frame, when the avatar fails to load", () => {
    render(<ProfileScreen record={FULL_RECORD} />);

    const image = document.querySelector("img");
    expect(image).not.toBeNull();
    fireEvent.error(image as HTMLImageElement);

    expect(screen.getByText("Ada Lovelace")).not.toBeNull();
    expect(document.querySelector("img")).toBeNull();
  });

  it("preserves the bio's line breaks with no markup parsed", () => {
    render(<ProfileScreen record={FULL_RECORD} />);

    const bio = screen.getByRole("button", { name: "Bio" });
    expect(bio.innerHTML).not.toContain("<br");
    expect(bio.textContent).toBe("Line one\nLine two");
  });
});

describe("ProfileScreen — email and account role are shown values (FR-024, FR-025, SC-006)", () => {
  it("renders both as shown values, identically for a member and an admin apart from the role's value", () => {
    render(<ProfileScreen record={FULL_RECORD} />);

    const email = screen.getByRole("group", { name: "Email" });
    const role = screen.getByRole("group", { name: "Account role" });
    expect(email.textContent).toContain("ada@example.com");
    expect(role.textContent).toContain("admin");
    expect(screen.queryByRole("button", { name: "Email" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Account role" })).toBeNull();
  });

  it("renders the member's role identically in shape, only the value differing", () => {
    render(<ProfileScreen record={EMPTY_RECORD} />);

    const role = screen.getByRole("group", { name: "Account role" });
    expect(role.textContent).toContain("member");
  });
});

describe("ProfileScreen — the display name (FR-004, OT-UX-019)", () => {
  it("joins first and last name with exactly one space", () => {
    render(<ProfileScreen record={EMPTY_RECORD} />);

    expect(screen.getByText("Ada Lovelace")).not.toBeNull();
  });
});

describe("ProfileScreen — change password (FR-026)", () => {
  it("offers the change-password link and no password field anywhere", () => {
    render(<ProfileScreen record={FULL_RECORD} />);

    expect(screen.getByRole("button", { name: "Change password" })).not.toBeNull();
    expect(document.querySelector('input[type="password"]')).toBeNull();
  });
});