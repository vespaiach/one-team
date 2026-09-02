import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { UserChip } from "./user-chip";

vi.mock("@/features/auth/actions", () => ({ signOut: vi.fn() }));

describe("UserChip (FR-017, FR-018, research B-5)", () => {
  it("renders the given display name, first and last joined by one space (s7)", () => {
    render(
      <UserChip
        displayName="Ada Lovelace"
        avatarUrl={null}
      />,
    );

    expect(screen.getByRole("link", { name: "Ada Lovelace" })).not.toBeNull();
  });

  it("renders the name alone with no substitute image when there is no avatarUrl", () => {
    const { container } = render(
      <UserChip
        displayName="Ada Lovelace"
        avatarUrl={null}
      />,
    );

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Ada Lovelace")).not.toBeNull();
  });

  it("renders the same name-alone state once an avatarUrl fails to load", () => {
    const { container } = render(
      <UserChip
        displayName="Ada Lovelace"
        avatarUrl="https://example.com/broken.png"
      />,
    );

    const image = container.querySelector("img");
    expect(image).not.toBeNull();
    if (image) {
      fireEvent.error(image);
    }

    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("Ada Lovelace")).not.toBeNull();
  });

  it("renders the avatar image when avatarUrl is present and has not failed", () => {
    const { container } = render(
      <UserChip
        displayName="Ada Lovelace"
        avatarUrl="https://example.com/ada.png"
      />,
    );

    expect(container.querySelector("img")).not.toBeNull();
  });

  it("truncates a 200-character name on one line while keeping it the link's full accessible name", () => {
    const longName = `${"A".repeat(100)} ${"B".repeat(99)}`;
    render(
      <UserChip
        displayName={longName}
        avatarUrl={null}
      />,
    );

    const link = screen.getByRole("link", { name: longName });
    expect(link).not.toBeNull();
    const nameNode = link.querySelector("span");
    expect(nameNode?.className).toContain("truncate");
  });

  it("renders the sign-out control as a sibling of the /profile link, never nested inside it", () => {
    render(
      <UserChip
        displayName="Ada Lovelace"
        avatarUrl={null}
      />,
    );

    const link = screen.getByRole("link", { name: "Ada Lovelace" });
    expect(link.getAttribute("href")).toBe("/profile");
    const signOutButton = screen.getByRole("button", { name: /sign out/i });
    expect(link.contains(signOutButton)).toBe(false);
  });
});