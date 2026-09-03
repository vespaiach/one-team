import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { LabelFormState } from "../actions";
import type { LabelView } from "../server/queries";
import { LabelFormModal } from "./label-form-modal";

function openModal(props: Partial<Parameters<typeof LabelFormModal>[0]> = {}) {
  const createLabelAction = vi
    .fn<(prevState: LabelFormState, input: { name: string }) => Promise<LabelFormState>>()
    .mockResolvedValue({ status: "idle" });
  const updateLabelAction = vi
    .fn<(prevState: LabelFormState, input: { id: string; name: string }) => Promise<LabelFormState>>()
    .mockResolvedValue({ status: "idle" });
  const checkNameAvailable = vi.fn().mockResolvedValue({ holder: null });

  render(
    <LabelFormModal
      createLabelAction={createLabelAction}
      updateLabelAction={updateLabelAction}
      checkNameAvailable={checkNameAvailable}
      {...props}
    />,
  );

  const triggerName = props.label ? /^edit$/i : /new label/i;
  fireEvent.click(screen.getByRole("button", { name: triggerName }));

  return { createLabelAction, updateLabelAction, checkNameAvailable };
}

const EXISTING_LABEL: LabelView = { id: "l1", name: "Bug", issueCount: 3 };

describe("LabelFormModal — Create mode (FR-006, FR-007, FR-008)", () => {
  it("opens with an empty name field", () => {
    openModal();

    const field = screen.getByLabelText(/name/i) as HTMLInputElement;
    expect(field.value).toBe("");
  });

  it("submits by calling createLabel, never updateLabel", async () => {
    const { createLabelAction, updateLabelAction } = openModal();

    const field = screen.getByLabelText(/name/i);
    fireEvent.change(field, { target: { value: "Bug" } });
    const form = screen.getByRole("dialog").querySelector("form");
    if (!form) throw new Error("no form found");
    fireEvent.submit(form);

    await waitFor(() => expect(createLabelAction).toHaveBeenCalled());
    expect(createLabelAction).toHaveBeenCalledWith(expect.anything(), { name: "Bug" });
    expect(updateLabelAction).not.toHaveBeenCalled();
  });
});

describe("LabelFormModal — Edit mode (FR-009, FR-010)", () => {
  it("pre-populates the name field from the label prop", () => {
    openModal({ label: EXISTING_LABEL });

    const field = screen.getByLabelText(/name/i) as HTMLInputElement;
    expect(field.value).toBe("Bug");
  });

  it("submits by calling updateLabel with the label's id, never createLabel", async () => {
    const { createLabelAction, updateLabelAction } = openModal({ label: EXISTING_LABEL });

    const field = screen.getByLabelText(/name/i);
    fireEvent.change(field, { target: { value: "Bugs" } });
    const form = screen.getByRole("dialog").querySelector("form");
    if (!form) throw new Error("no form found");
    fireEvent.submit(form);

    await waitFor(() => expect(updateLabelAction).toHaveBeenCalled());
    expect(updateLabelAction).toHaveBeenCalledWith(expect.anything(), { id: "l1", name: "Bugs" });
    expect(createLabelAction).not.toHaveBeenCalled();
  });
});

describe("LabelFormModal — on-blur clash validation (FR-007, research C-2, D-2)", () => {
  it("reports a clash inline naming the holder, without submitting", async () => {
    const checkNameAvailable = vi.fn().mockResolvedValue({ holder: { id: "l2", name: "Feature" } });
    const { createLabelAction } = openModal({ checkNameAvailable });

    const field = screen.getByLabelText(/name/i);
    fireEvent.change(field, { target: { value: "Feature" } });
    fireEvent.blur(field);

    expect(await screen.findByText(/feature/i)).not.toBeNull();
    expect(createLabelAction).not.toHaveBeenCalled();
  });
});

describe("LabelFormModal — Escape and Cancel discard (FR-008)", () => {
  it("discards on Cancel, calling neither mutator", () => {
    const { createLabelAction, updateLabelAction } = openModal();

    const field = screen.getByLabelText(/name/i);
    fireEvent.change(field, { target: { value: "Bug" } });
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(createLabelAction).not.toHaveBeenCalled();
    expect(updateLabelAction).not.toHaveBeenCalled();
  });

  it("discards on Escape, calling neither mutator", () => {
    const { createLabelAction, updateLabelAction } = openModal();

    const field = screen.getByLabelText(/name/i);
    fireEvent.change(field, { target: { value: "Bug" } });
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(createLabelAction).not.toHaveBeenCalled();
    expect(updateLabelAction).not.toHaveBeenCalled();
  });
});

describe("LabelFormModal — submit control stays enabled through invalid input (research D-2, OT-UX-011)", () => {
  it("stays enabled while a clash is reported, and disables only while its own request is in flight", async () => {
    const checkNameAvailable = vi.fn().mockResolvedValue({ holder: { id: "l2", name: "Feature" } });
    let resolveAction: (value: LabelFormState) => void = () => undefined;
    const createLabelAction = vi.fn().mockImplementation(
      () =>
        new Promise<LabelFormState>((resolve) => {
          resolveAction = resolve;
        }),
    );
    openModal({ checkNameAvailable, createLabelAction });

    const field = screen.getByLabelText(/name/i);
    fireEvent.change(field, { target: { value: "Feature" } });
    fireEvent.blur(field);
    await screen.findByText(/feature/i);

    const submit = screen.getByRole("button", { name: /create label/i });
    expect((submit as HTMLButtonElement).disabled).toBe(false);

    const form = screen.getByRole("dialog").querySelector("form");
    if (!form) throw new Error("no form found");
    fireEvent.submit(form);

    const pendingSubmit = await screen.findByRole("button", { name: /creating/i });
    expect((pendingSubmit as HTMLButtonElement).disabled).toBe(true);

    resolveAction({ status: "duplicate_name", holder: { id: "l2", name: "Feature" } });
  });
});