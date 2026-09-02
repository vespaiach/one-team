import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { updateOwnProfile } from "../actions";
import { EditableField } from "./editable-field";

vi.mock("../actions", () => ({
  updateOwnProfile: vi.fn(),
}));

const raiseMessageMock = vi.fn();
vi.mock("@/features/shell/messages", () => ({
  raiseMessage: (...args: unknown[]) => raiseMessageMock(...args),
}));

function setOnline(value: boolean) {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, value });
}

beforeEach(() => {
  setOnline(true);
  vi.mocked(updateOwnProfile).mockReset();
  raiseMessageMock.mockClear();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("EditableField — the affordance and the gestures (FR-013, FR-013a)", () => {
  it("becomes a focused field carrying the current value when pressed", async () => {
    render(
      <EditableField
        field="jobTitle"
        label="Job title"
        value="Engineer"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Job title" }));

    const input = await screen.findByRole("textbox", { name: "Job title" });
    expect((input as HTMLInputElement).value).toBe("Engineer");
    expect(document.activeElement).toBe(input);
  });

  it("restores the previous value and writes nothing on Escape", async () => {
    render(
      <EditableField
        field="jobTitle"
        label="Job title"
        value="Engineer"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Job title" }));
    const input = await screen.findByRole("textbox", { name: "Job title" });
    fireEvent.change(input, { target: { value: "Staff Engineer" } });
    fireEvent.keyDown(input, { key: "Escape" });

    const button = await screen.findByRole("button", { name: "Job title" });
    expect(button.textContent).toBe("Engineer");
    expect(updateOwnProfile).not.toHaveBeenCalled();
  });

  it("writes a changed value on blur", async () => {
    vi.mocked(updateOwnProfile).mockResolvedValue({ status: "accepted" });
    render(
      <EditableField
        field="jobTitle"
        label="Job title"
        value="Engineer"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Job title" }));
    const input = await screen.findByRole("textbox", { name: "Job title" });
    fireEvent.change(input, { target: { value: "Staff Engineer" } });
    fireEvent.blur(input);

    await waitFor(() => expect(updateOwnProfile).toHaveBeenCalledWith("jobTitle", "Staff Engineer"));
  });

  it("writes nothing on blur when the value did not change", async () => {
    render(
      <EditableField
        field="jobTitle"
        label="Job title"
        value="Engineer"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Job title" }));
    const input = await screen.findByRole("textbox", { name: "Job title" });
    fireEvent.blur(input);

    await screen.findByRole("button", { name: "Job title" });
    expect(updateOwnProfile).not.toHaveBeenCalled();
  });

  it("saves on Cmd+Enter without waiting for blur", async () => {
    vi.mocked(updateOwnProfile).mockResolvedValue({ status: "accepted" });
    render(
      <EditableField
        field="jobTitle"
        label="Job title"
        value="Engineer"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Job title" }));
    const input = await screen.findByRole("textbox", { name: "Job title" });
    fireEvent.change(input, { target: { value: "Staff Engineer" } });
    fireEvent.keyDown(input, { key: "Enter", metaKey: true });

    await waitFor(() => expect(updateOwnProfile).toHaveBeenCalledWith("jobTitle", "Staff Engineer"));
  });

  it("does nothing on a plain Enter in a single-line field", async () => {
    render(
      <EditableField
        field="jobTitle"
        label="Job title"
        value="Engineer"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Job title" }));
    const input = await screen.findByRole("textbox", { name: "Job title" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(updateOwnProfile).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Job title" })).toBe(input);
  });

  it("allows a plain Enter in the bio without saving or closing the field", async () => {
    render(
      <EditableField
        field="bio"
        label="Bio"
        value="Line one"
        multiline
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Bio" }));
    const textarea = await screen.findByRole("textbox", { name: "Bio" });
    fireEvent.keyDown(textarea, { key: "Enter" });

    expect(updateOwnProfile).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Bio" })).toBe(textarea);
  });

  it("returns focus to the button after Escape", async () => {
    render(
      <EditableField
        field="jobTitle"
        label="Job title"
        value="Engineer"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Job title" }));
    const input = await screen.findByRole("textbox", { name: "Job title" });
    fireEvent.keyDown(input, { key: "Escape" });

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Job title" })),
    );
  });

  it("returns focus to the button after a save", async () => {
    vi.mocked(updateOwnProfile).mockResolvedValue({ status: "accepted" });
    render(
      <EditableField
        field="jobTitle"
        label="Job title"
        value="Engineer"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Job title" }));
    const input = await screen.findByRole("textbox", { name: "Job title" });
    fireEvent.change(input, { target: { value: "Staff Engineer" } });
    fireEvent.blur(input);

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Job title" })),
    );
  });
});

describe("EditableField — required fields (FR-007, FR-017)", () => {
  it("shows an inline error and writes nothing for an empty required field", async () => {
    render(
      <EditableField
        field="firstName"
        label="First name"
        value="Ada"
        required
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "First name" }));
    const input = await screen.findByRole("textbox", { name: "First name" });
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.blur(input);

    expect(await screen.findByText("First name is required.")).not.toBeNull();
    expect(updateOwnProfile).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "First name" })).toBe(input);
  });
});

describe("EditableField — optimistic save and rollback (FR-014, FR-015, SC-003)", () => {
  it("renders the new value immediately, before the server answers", async () => {
    let resolveAction: (value: { status: "accepted" }) => void = () => undefined;
    vi.mocked(updateOwnProfile).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        }),
    );

    render(
      <EditableField
        field="jobTitle"
        label="Job title"
        value="Engineer"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Job title" }));
    const input = await screen.findByRole("textbox", { name: "Job title" });
    fireEvent.change(input, { target: { value: "Staff Engineer" } });
    fireEvent.blur(input);

    const button = await screen.findByRole("button", { name: "Job title" });
    expect(button.textContent).toBe("Staff Engineer");

    resolveAction({ status: "accepted" });
  });

  it("rolls back to the server's value and raises a message on refusal", async () => {
    vi.mocked(updateOwnProfile).mockResolvedValue({ status: "refused", reason: "too_long" });

    render(
      <EditableField
        field="jobTitle"
        label="Job title"
        value="Engineer"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Job title" }));
    const input = await screen.findByRole("textbox", { name: "Job title" });
    fireEvent.change(input, { target: { value: "Staff Engineer" } });
    fireEvent.blur(input);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Job title" }).textContent).toBe("Engineer"),
    );
    expect(raiseMessageMock).toHaveBeenCalledWith("error", expect.stringContaining("Job title"));
  });

  it("rolls back only the field that failed, leaving a sibling field's saved value untouched", async () => {
    vi.mocked(updateOwnProfile).mockImplementation(async (field) => {
      if (field === "jobTitle") {
        return { status: "refused", reason: "too_long" };
      }
      return { status: "accepted" };
    });

    const { rerender } = render(
      <>
        <EditableField
          field="jobTitle"
          label="Job title"
          value="Engineer"
        />
        <EditableField
          field="phone"
          label="Phone"
          value="+1 555 0100"
        />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Phone" }));
    const phoneInput = await screen.findByRole("textbox", { name: "Phone" });
    fireEvent.change(phoneInput, { target: { value: "+1 555 0199" } });
    fireEvent.blur(phoneInput);
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Phone" }).textContent).toBe("+1 555 0199"),
    );
    rerender(
      <>
        <EditableField
          field="jobTitle"
          label="Job title"
          value="Engineer"
        />
        <EditableField
          field="phone"
          label="Phone"
          value="+1 555 0199"
        />
      </>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Job title" }));
    const jobInput = await screen.findByRole("textbox", { name: "Job title" });
    fireEvent.change(jobInput, { target: { value: "Staff Engineer" } });
    fireEvent.blur(jobInput);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Job title" }).textContent).toBe("Engineer"),
    );
    expect(screen.getByRole("button", { name: "Phone" }).textContent).toBe("+1 555 0199");
  });
});

describe("EditableField — the lost connection (FR-034)", () => {
  it("refuses the save before dispatching, with the distinct wording, when offline", async () => {
    setOnline(false);

    render(
      <EditableField
        field="jobTitle"
        label="Job title"
        value="Engineer"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Job title" }));
    const input = await screen.findByRole("textbox", { name: "Job title" });
    fireEvent.change(input, { target: { value: "Staff Engineer" } });
    fireEvent.blur(input);

    expect(await screen.findByText("Changes need a connection")).not.toBeNull();
    expect(updateOwnProfile).not.toHaveBeenCalled();
    expect(raiseMessageMock).toHaveBeenCalledWith("error", "Changes need a connection");
  });
});

describe("EditableField — empty optional fields (FR-012b)", () => {
  it("shows the placeholder line as the button label when the value is unset", () => {
    render(
      <EditableField
        field="jobTitle"
        label="Job title"
        value={null}
        placeholder="Add a job title"
      />,
    );

    expect(screen.getByRole("button", { name: "Job title" }).textContent).toBe("Add a job title");
  });
});