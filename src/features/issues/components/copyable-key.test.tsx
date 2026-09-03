import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyableKey } from "./copyable-key";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("CopyableKey (FR-042)", () => {
  it("copies the issue's full address, the same one the browser shows", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<CopyableKey issueKey="WEB-142" />);
    fireEvent.click(screen.getByRole("button", { name: /WEB-142/i }));

    expect(writeText).toHaveBeenCalledWith(window.location.href);
  });

  it("shows the issue key as the control's visible content", () => {
    render(<CopyableKey issueKey="WEB-142" />);

    expect(screen.getByRole("button", { name: /WEB-142/i }).textContent).toBe("WEB-142");
  });

  it("is enabled for every signed-in user, because copying a link is not a write", () => {
    render(<CopyableKey issueKey="WEB-142" />);

    const button = screen.getByRole("button", { name: /WEB-142/i });
    expect(button.hasAttribute("disabled")).toBe(false);
    expect(button.getAttribute("aria-disabled")).not.toBe("true");
  });
});