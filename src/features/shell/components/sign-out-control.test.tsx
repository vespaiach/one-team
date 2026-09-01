import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { signOutMock } = vi.hoisted(() => ({ signOutMock: vi.fn() }));
vi.mock("@/features/auth/actions", () => ({ signOut: signOutMock }));

describe("SignOutControl (FR-018, FR-030, contracts/sign-out.md)", () => {
  it("submits through a form action targeting signOut rather than an onPress handler", async () => {
    const { SignOutControl } = await import("./sign-out-control");
    render(<SignOutControl />);

    const button = screen.getByRole("button", { name: /sign out/i });
    const form = button.closest("form");
    expect(form).not.toBeNull();

    fireEvent.click(button);

    expect(signOutMock).toHaveBeenCalled();
  });

  it("renders a react-aria-components Button with a submit type and an accessible name", async () => {
    const { SignOutControl } = await import("./sign-out-control");
    render(<SignOutControl />);

    const button = screen.getByRole("button", { name: /sign out/i });
    expect(button.getAttribute("type")).toBe("submit");
  });

  it("is a real focusable control", async () => {
    const { SignOutControl } = await import("./sign-out-control");
    render(<SignOutControl />);

    const button = screen.getByRole("button", { name: /sign out/i });
    button.focus();
    expect(document.activeElement).toBe(button);
  });
});