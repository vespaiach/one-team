import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Composer } from "./composer";

function renderComposer(overrides: Partial<Parameters<typeof Composer>[0]> = {}) {
  const onSubmit = vi.fn();
  const utils = render(
    <Composer
      target={{ projectId: "project-1" }}
      canPost={true}
      postReason={null}
      onSubmit={onSubmit}
      {...overrides}
    />,
  );
  return { onSubmit, ...utils };
}

describe("Composer — validation (FR-040, FR-041, US1 s4, s5)", () => {
  it("trims on submit and refuses an empty-after-trim submission inline, issuing no submit call", () => {
    const { onSubmit } = renderComposer();
    const field = screen.getByRole("textbox", { name: "Comment" });

    fireEvent.change(field, { target: { value: "   \n\t  " } });
    fireEvent.keyDown(field, { key: "Enter", metaKey: true });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/can't be empty/i)).not.toBeNull();
  });

  it("refuses a 10001-character body on the field naming the bound, never truncating", () => {
    const { onSubmit } = renderComposer();
    const field = screen.getByRole("textbox", { name: "Comment" }) as HTMLTextAreaElement;
    const tooLong = "a".repeat(10001);

    fireEvent.change(field, { target: { value: tooLong } });
    fireEvent.keyDown(field, { key: "Enter", metaKey: true });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText(/10,000 characters or fewer/)).not.toBeNull();
    expect(field.value).toBe(tooLong);
  });

  it("submits the trimmed body on cmd-enter", () => {
    const { onSubmit } = renderComposer();
    const field = screen.getByRole("textbox", { name: "Comment" });

    fireEvent.change(field, { target: { value: "  Looks good.  " } });
    fireEvent.keyDown(field, { key: "Enter", metaKey: true });

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledWith("Looks good.");
  });
});

describe("Composer — disabled state (FR-021, FR-035, FR-061)", () => {
  it("renders disabled with postReason as its accessible description, never hidden", () => {
    renderComposer({ canPost: false, postReason: "Join Website Redesign to comment." });

    const field = screen.getByRole("textbox", { name: "Comment" }) as HTMLTextAreaElement;
    expect(field.disabled).toBe(true);
    const reasonText = screen.getByText("Join Website Redesign to comment.");
    expect(reasonText).not.toBeNull();
    expect(field.getAttribute("aria-describedby")).toBe(reasonText.id);
  });
});