"use client";

import type { FormEvent } from "react";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "react-aria-components/Button";
import { Dialog, DialogTrigger } from "react-aria-components/Dialog";
import { Form } from "react-aria-components/Form";
import { Modal } from "react-aria-components/Modal";
import { FieldError, Input, Label, TextField } from "react-aria-components/TextField";
import type { LabelFormState } from "../actions";
import type { LabelView } from "../server/queries";

export type CreateLabelAction = (
  prevState: LabelFormState,
  input: { name: string },
) => Promise<LabelFormState>;
export type UpdateLabelAction = (
  prevState: LabelFormState,
  input: { id: string; name: string },
) => Promise<LabelFormState>;
export type CheckLabelNameAvailable = (
  name: string,
) => Promise<{ holder: { id: string; name: string } | null }>;

const INITIAL_STATE: LabelFormState = { status: "idle" };

function LabelFormDialogContent({
  label,
  createLabelAction,
  updateLabelAction,
  checkNameAvailable,
  close,
}: {
  label?: LabelView;
  createLabelAction: CreateLabelAction;
  updateLabelAction: UpdateLabelAction;
  checkNameAvailable: CheckLabelNameAvailable;
  close: () => void;
}) {
  const isEdit = label !== undefined;
  const initialName = label?.name ?? "";

  async function submit(prevState: LabelFormState, nextName: string): Promise<LabelFormState> {
    return label
      ? updateLabelAction(prevState, { id: label.id, name: nextName })
      : createLabelAction(prevState, { name: nextName });
  }

  const [state, dispatch, isPending] = useActionState(submit, INITIAL_STATE);
  const [name, setName] = useState(initialName);
  const [blurCheck, setBlurCheck] = useState<{ id: string; name: string } | null>(null);
  const handledStateRef = useRef<LabelFormState | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (state.status === "saved" && handledStateRef.current !== state) {
      handledStateRef.current = state;
      close();
    }
  }, [state, close]);

  async function handleBlur() {
    const trimmed = name.trim();
    if (trimmed === "" || trimmed === initialName) {
      setBlurCheck(null);
      return;
    }
    const result = await checkNameAvailable(trimmed);
    setBlurCheck(result.holder);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startTransition(() => {
      dispatch(name);
    });
  }

  const clash = state.status === "duplicate_name" ? state.holder : blurCheck;

  return (
    <Dialog className="flex w-full max-w-[420px] flex-col gap-[14px] bg-(--color-bg) p-4 shadow-lg">
      <h2 className="text-h5">{isEdit ? "Edit label" : "New label"}</h2>
      <Form
        onSubmit={handleSubmit}
        validationBehavior="aria"
        className="flex flex-col gap-[14px]">
        <TextField
          value={name}
          onChange={setName}
          onBlur={handleBlur}
          isRequired
          isInvalid={clash !== null}
          className="flex flex-col gap-[5px]">
          <Label>Name</Label>
          <Input autoFocus />
          {clash && <FieldError>"{clash.name}" already exists.</FieldError>}
        </TextField>

        <div className="flex justify-end gap-[8px]">
          <Button
            type="button"
            onPress={close}>
            Cancel
          </Button>
          <Button
            type="submit"
            isDisabled={isPending}>
            {isEdit ? (isPending ? "Saving…" : "Save") : isPending ? "Creating…" : "Create label"}
          </Button>
        </div>
      </Form>
    </Dialog>
  );
}

export function LabelFormModal({
  label,
  createLabelAction,
  updateLabelAction,
  checkNameAvailable,
}: {
  label?: LabelView;
  createLabelAction: CreateLabelAction;
  updateLabelAction: UpdateLabelAction;
  checkNameAvailable: CheckLabelNameAvailable;
}) {
  return (
    <DialogTrigger>
      <Button>{label ? "Edit" : "New label"}</Button>
      <Modal
        isDismissable={false}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        {({ state }) => (
          <LabelFormDialogContent
            label={label}
            createLabelAction={createLabelAction}
            updateLabelAction={updateLabelAction}
            checkNameAvailable={checkNameAvailable}
            close={state.close}
          />
        )}
      </Modal>
    </DialogTrigger>
  );
}