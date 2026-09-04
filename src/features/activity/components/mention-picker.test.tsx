import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { MentionCandidateGroups } from "../server/mention-queries";
import { MentionPicker } from "./mention-picker";

const SCOPED = [
  { id: "member-1", firstName: "Ada", lastName: "Lovelace" },
  { id: "member-2", firstName: "Alan", lastName: "Turing" },
];
const EVERYONE_ELSE = [{ id: "outsider-1", firstName: "Zoe", lastName: "Zephyr" }];

function groups(): MentionCandidateGroups {
  return { scoped: SCOPED, everyoneElse: EVERYONE_ELSE };
}

function renderPicker(overrides: Partial<Parameters<typeof MentionPicker>[0]> = {}) {
  const onSelect = vi.fn();
  const onClose = vi.fn();
  const listCandidates = vi.fn().mockResolvedValue(groups());
  const triggerRef = createRef<HTMLDivElement>();
  triggerRef.current = document.createElement("div");

  const utils = render(
    <MentionPicker
      target={{ projectId: "project-1" }}
      query=""
      triggerRef={triggerRef}
      listCandidates={listCandidates}
      onSelect={onSelect}
      onClose={onClose}
      debounceMs={0}
      {...overrides}
    />,
  );
  return { ...utils, onSelect, onClose, listCandidates, triggerRef };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("MentionPicker (FR-024, FR-025, US4 s1, s4)", () => {
  it("opens with the full ranked list even with no letters typed yet, scoped above everyoneElse", async () => {
    renderPicker({ query: "" });

    await screen.findByRole("option", { name: "Ada Lovelace" });
    const options = screen.getAllByRole("option").map((option) => option.textContent);
    expect(options).toEqual(["Ada Lovelace", "Alan Turing", "Zoe Zephyr"]);
  });

  it("re-queries listCandidates live on every keystroke", async () => {
    const { rerender, listCandidates, onSelect, onClose, triggerRef } = renderPicker({ query: "a" });
    await waitFor(() => expect(listCandidates).toHaveBeenCalledTimes(1));

    rerender(
      <MentionPicker
        target={{ projectId: "project-1" }}
        query="al"
        triggerRef={triggerRef}
        listCandidates={listCandidates}
        onSelect={onSelect}
        onClose={onClose}
        debounceMs={0}
      />,
    );

    await waitFor(() => expect(listCandidates).toHaveBeenCalledTimes(2));
  });

  it("narrows to entries whose name matches the typed fragment", async () => {
    renderPicker({ query: "turing" });

    await screen.findByRole("option", { name: "Alan Turing" });
    expect(screen.queryByRole("option", { name: "Ada Lovelace" })).toBeNull();
    expect(screen.queryByRole("option", { name: "Zoe Zephyr" })).toBeNull();
  });

  it("closes on Escape without selecting anything", async () => {
    const { onClose, onSelect } = renderPicker();
    await screen.findByRole("option", { name: "Ada Lovelace" });

    fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it("calls onSelect with the chosen candidate", async () => {
    const { onSelect } = renderPicker();
    const option = await screen.findByRole("option", { name: "Alan Turing" });

    fireEvent.click(option);

    expect(onSelect).toHaveBeenCalledWith({ id: "member-2", firstName: "Alan", lastName: "Turing" });
  });
});