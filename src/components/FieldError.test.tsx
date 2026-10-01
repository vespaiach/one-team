import { useState, type FormEvent } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { saveJson } from "../lib/save.ts";
import { FieldError } from "./FieldError.tsx";
import { Button, TextInput } from "./hairline.ts";
import { ToastProvider, useToast } from "./Toast.tsx";

const message = "Enter a name.";

function NameForm() {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | undefined>();
  const { showToast } = useToast();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const result = await saveJson("/api/things", { name });
    if (result.ok) {
      setError(undefined);
    } else if ("fields" in result) {
      setError(result.fields.name);
    } else {
      showToast(result.toast);
    }
  }

  return (
    <form onSubmit={submit}>
      <TextInput
        id="name"
        label="Name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={error ? "name-error" : undefined}
      />
      {error ? <FieldError fieldId="name" message={error} /> : null}
      <Button variant="primary" type="submit">
        Save
      </Button>
    </form>
  );
}

function stubFetch(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
}

function renderForm() {
  render(
    <ToastProvider>
      <NameForm />
    </ToastProvider>,
  );
  return screen.getByLabelText("Name") as HTMLInputElement;
}

async function save() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
  });
}

describe("FieldError", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the 422 message under the field, linked to it, and keeps the typed text", async () => {
    stubFetch(422, { error: { message: "Invalid", fields: { name: message } } });
    const field = renderForm();
    fireEvent.change(field, { target: { value: "   " } });

    await save();

    const error = await screen.findByText(message);
    expect(error.textContent).toBe(message);
    expect(field.getAttribute("aria-invalid")).toBe("true");
    const describedBy = field.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(error.id).toBe(describedBy);
    expect(document.getElementById(describedBy as string)?.textContent).toBe(message);
    expect(field.compareDocumentPosition(error) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(field.value).toBe("   ");
  });

  it("wraps the message instead of truncating it", async () => {
    stubFetch(422, { error: { message: "Invalid", fields: { name: message } } });
    renderForm();

    await save();

    const error = await screen.findByText(message);
    const style = getComputedStyle(error);
    expect(style.overflowWrap).toBe("anywhere");
    expect(style.whiteSpace).not.toBe("nowrap");
    expect(style.textOverflow).not.toBe("ellipsis");
    expect(error.textContent).toBe(message);
  });

  it.each([
    [500, { error: { message: "Server error" } }, "Couldn't save. Try again."],
    [403, { error: { message: "Forbidden" } }, "You don't have permission to do that."],
  ])("keeps the typed text and shows the toast after a %i", async (status, body, toast) => {
    stubFetch(status, body);
    const field = renderForm();
    fireEvent.change(field, { target: { value: "Alpha" } });

    await save();

    expect(await screen.findByText(toast)).toBeTruthy();
    expect(field.value).toBe("Alpha");
    expect(screen.queryByText(message)).toBeNull();
  });
});
