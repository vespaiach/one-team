import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectKeyField } from "./project-key-field";

afterEach(() => {
  vi.restoreAllMocks();
});

function renderField(props: {
  name: string;
  onChange?: (key: string) => void;
  checkAvailability?: (key: string) => Promise<{ holder: { key: string; name: string } | null }>;
}) {
  const onChange = props.onChange ?? vi.fn();
  const checkAvailability = props.checkAvailability ?? vi.fn().mockResolvedValue({ holder: null });
  const utils = render(
    <ProjectKeyField
      name={props.name}
      onChange={onChange}
      checkAvailability={checkAvailability}
      debounceMs={0}
    />,
  );
  return { ...utils, onChange, checkAvailability };
}

describe("ProjectKeyField (FR-025)", () => {
  it("follows the name, deriving the key as it changes", () => {
    const { rerender, onChange } = renderField({ name: "Website Redesign" });

    expect((screen.getByLabelText("Key") as HTMLInputElement).value).toBe("WR");

    rerender(
      <ProjectKeyField
        name="One Team Design Ops"
        onChange={onChange}
        checkAvailability={vi.fn().mockResolvedValue({ holder: null })}
        debounceMs={0}
      />,
    );

    expect((screen.getByLabelText("Key") as HTMLInputElement).value).toBe("OTDO");
  });

  it("stops following the name once the user edits the key by hand", () => {
    const { rerender, onChange } = renderField({ name: "Website Redesign" });

    fireEvent.change(screen.getByLabelText("Key"), { target: { value: "CUSTOM" } });
    expect((screen.getByLabelText("Key") as HTMLInputElement).value).toBe("CUSTOM");

    rerender(
      <ProjectKeyField
        name="A Totally Different Name"
        onChange={onChange}
        checkAvailability={vi.fn().mockResolvedValue({ holder: null })}
        debounceMs={0}
      />,
    );

    expect((screen.getByLabelText("Key") as HTMLInputElement).value).toBe("CUSTOM");
  });

  it("uppercases as typed", () => {
    renderField({ name: "" });

    fireEvent.change(screen.getByLabelText("Key"), { target: { value: "abc" } });

    expect((screen.getByLabelText("Key") as HTMLInputElement).value).toBe("ABC");
  });

  it("leaves the field empty and required when the derived value fails the key pattern", () => {
    renderField({ name: "3D Redesign" });

    const input = screen.getByLabelText("Key") as HTMLInputElement;
    expect(input.value).toBe("");
    expect(input.required).toBe(true);
    expect(screen.getByText("A key is required.")).toBeDefined();
  });

  it("renders a clash as an inline error naming the holder, applying no suffix", async () => {
    const checkAvailability = vi.fn().mockResolvedValue({ holder: { key: "WR", name: "Another Project" } });
    renderField({ name: "Website Redesign", checkAvailability });

    await waitFor(() => expect(checkAvailability).toHaveBeenCalledWith("WR"));

    await screen.findByText("Another Project already uses this key.");
    expect((screen.getByLabelText("Key") as HTMLInputElement).value).toBe("WR");
  });
});