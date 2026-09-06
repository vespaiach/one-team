import { fireEvent, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { BoardCard, BoardPerson, BoardView } from "../server/board-queries";
import { BoardScreen } from "./board-screen";

vi.mock("@/features/issues/actions", () => ({
  moveIssue: vi.fn(),
  createBoardCard: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

const BACKLOG = "0198d2b1-0000-7000-8000-0000000000c1";
const IN_PROGRESS = "0198d2b1-0000-7000-8000-0000000000c2";
const DONE = "0198d2b1-0000-7000-8000-0000000000c3";

const GRACE: BoardPerson = {
  id: "0198d2b1-0000-7000-8000-0000000000a1",
  firstName: "Grace",
  lastName: "Hopper",
  avatarUrl: null,
};

const WRITE_REASON = "Only project members can edit issues in Website Redesign.";
const TITLE_REQUIRED = "Title is required.";

function card(
  number: number,
  title: string,
  columnId: string,
  overrides: Partial<BoardCard> = {},
): BoardCard {
  return {
    id: `0198d2b1-0000-7000-8000-00000000${String(number).padStart(4, "0")}`,
    key: `WEB-${number}`,
    title,
    columnId,
    assigneeId: null,
    priority: "none",
    dueDate: null,
    labels: [],
    assignee: null,
    commentCount: 0,
    order: number,
    ...overrides,
  };
}

const CARDS: BoardCard[] = [
  card(11, "Rework the sign-in copy", IN_PROGRESS, {
    priority: "high",
    dueDate: "2026-02-01",
    commentCount: 3,
    assigneeId: GRACE.id,
    assignee: GRACE,
    labels: [
      { id: "0198d2b1-0000-7000-8000-0000000000b1", name: "backend" },
      { id: "0198d2b1-0000-7000-8000-0000000000b2", name: "regression" },
    ],
  }),
  card(12, "Retire the legacy tokens", BACKLOG, {
    priority: "low",
    labels: [{ id: "0198d2b1-0000-7000-8000-0000000000b3", name: "chore" }],
  }),
  card(13, "Audit the empty states", BACKLOG),
];

function board(canWrite: boolean): BoardView {
  return {
    project: {
      id: "0198d2b1-0000-7000-8000-0000000000f1",
      key: "WEB",
      name: "Website Redesign",
      status: "active",
    },
    columns: [
      { id: BACKLOG, name: "Backlog" },
      { id: IN_PROGRESS, name: "In Progress" },
      { id: DONE, name: "Done" },
    ],
    cards: CARDS,
    assigneePool: [GRACE],
    assignedOutsidePool: [],
    canWrite,
    writeReason: WRITE_REASON,
  };
}

function Header({ control }: { control?: ReactNode }) {
  return <div data-region="header">{control}</div>;
}

function renderBoard(canWrite = true) {
  return render(
    <BoardScreen board={board(canWrite)}>
      <Header />
    </BoardScreen>,
  );
}

function accessibleName(element: Element): string {
  const label = element.getAttribute("aria-label");
  if (label !== null) {
    return label.trim();
  }
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy !== null) {
    return labelledBy
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent ?? "")
      .join(" ")
      .trim();
  }
  return (element.textContent ?? "").trim();
}

function describedText(element: Element): string {
  const describedBy = element.getAttribute("aria-describedby");
  if (describedBy === null) {
    return "";
  }
  return describedBy
    .split(" ")
    .map((id) => document.getElementById(id)?.textContent ?? "")
    .join(" ")
    .trim();
}

function controlsIn(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>("button, a[href], input")];
}

function cardRows(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[role="row"]')].filter((row) =>
    row.hasAttribute("aria-label"),
  );
}

function suppressesOutline(element: Element): boolean {
  return /(^|:)outline-(none|hidden|0)\b/.test(element.className);
}

function identityColour(element: Element): string {
  const inline = element.getAttribute("style") ?? "";
  const utilities = element.className.match(/\b(?:bg|text|border|fill|from|via|to)-\[[^\]]*\]/g) ?? [];
  const inlineColour = /(?:^|;)\s*(?:color|background|background-color|border-color|fill)\s*:/.test(inline)
    ? inline
    : "";
  return [inlineColour, ...utilities].join(" ").trim();
}

describe("Board — a11y: every control the feature adds carries an accessible name (FR-043, SC-015)", () => {
  it("names every button, link and text input on a writable board", () => {
    const { container } = renderBoard();

    const controls = controlsIn(container);

    expect(controls.map(accessibleName).sort()).toEqual([
      "Add a card",
      "Add a card",
      "Add a card",
      "Column Group by",
      "Drag WEB-11 Rework the sign-in copy",
      "Drag WEB-12 Retire the legacy tokens",
      "Drag WEB-13 Audit the empty states",
      "Open the full form",
      "Open the full form",
      "Open the full form",
      "WEB-11 Rework the sign-in copy",
      "WEB-12 Retire the legacy tokens",
      "WEB-13 Audit the empty states",
    ]);
  });

  it("names every button, link and text input on a read-only board", () => {
    const { container } = renderBoard(false);

    const unnamed = controlsIn(container).filter((control) => accessibleName(control) === "");

    expect(unnamed.map((control) => control.outerHTML)).toEqual([]);
  });

  it("names every lane, so every drop target has a name", () => {
    renderBoard();

    for (const laneName of ["Backlog", "In Progress", "Done"]) {
      expect(screen.getByRole("grid", { name: laneName })).toBeDefined();
    }
  });

  it("names every card row by its key and title", () => {
    const { container } = renderBoard();

    expect(cardRows(container).map(accessibleName)).toEqual([
      "WEB-12 Retire the legacy tokens",
      "WEB-13 Audit the empty states",
      "WEB-11 Rework the sign-in copy",
    ]);
  });

  it("names the grouping control", () => {
    renderBoard();

    expect(accessibleName(screen.getByRole("button", { name: /Group by/ }))).toContain("Group by");
  });
});

describe("Board — a11y: every control keeps the one focus indicator globals.css declares (FR-043, SC-015)", () => {
  it("leaves every control focusable", () => {
    const { container } = renderBoard();

    const unfocusable = controlsIn(container).filter((control) => {
      control.focus();
      return document.activeElement !== control;
    });

    expect(unfocusable.map((control) => accessibleName(control))).toEqual([]);
  });

  it("leaves every card row focusable", () => {
    const { container } = renderBoard();

    const unfocusable = cardRows(container).filter((row) => {
      row.focus();
      return document.activeElement !== row;
    });

    expect(unfocusable.map((row) => accessibleName(row))).toEqual([]);
  });

  it("suppresses the outline on nothing the board renders", () => {
    const { container } = renderBoard();

    const suppressed = [...container.querySelectorAll("*")].filter(suppressesOutline);

    expect(suppressed.map((element) => element.className)).toEqual([]);
  });
});

describe("Board — a11y: no state and no error is conveyed through colour alone (FR-043, SC-015)", () => {
  it("associates the composer's empty-title error with the composer, as text", () => {
    renderBoard();

    const composer = within(
      screen.getByRole("grid", { name: "Backlog" }).closest("[data-region='lane']") as HTMLElement,
    ).getByRole("textbox", { name: "Add a card" });
    fireEvent.keyDown(composer, { key: "Enter" });

    expect(composer.getAttribute("aria-invalid")).toBe("true");
    expect(describedText(composer)).toContain(TITLE_REQUIRED);
  });

  it("carries the refusal as the disabled composer's own name, never as colour", () => {
    renderBoard(false);

    expect(screen.getAllByRole("textbox", { name: WRITE_REASON }).length).toBe(3);
    expect(screen.getAllByRole("button", { name: WRITE_REASON }).length).toBe(3);
  });

  it("marks the drop target by outline width and indicator height, not by colour alone", () => {
    renderBoard();

    const lane = screen.getByRole("grid", { name: "Backlog" });

    expect(lane.className).toContain("data-[drop-target]:outline-2");
  });

  it("marks the selected grouping by weight and underline, not by colour alone", () => {
    renderBoard();

    fireEvent.click(screen.getByRole("button", { name: /Group by/ }));
    const selected = screen.getByRole("option", { name: "Column" });

    expect(selected.getAttribute("aria-selected")).toBe("true");
    expect(selected.className).toContain("data-[selected]:font-semibold");
    expect(selected.className).toContain("data-[selected]:underline");
  });

  it("states the priority in words beside its glyph", () => {
    renderBoard();

    expect(accessibleName(screen.getByRole("img", { name: "Priority: High" }))).toBe("Priority: High");
  });
});

describe("Board — a11y: nothing on the board is identified by colour (FR-011, SC-016)", () => {
  it("gives every label the same styling, so only its name tells it apart", () => {
    const { container } = renderBoard();

    const labels = [...container.querySelectorAll<HTMLElement>("li")];

    expect(labels.map((label) => label.textContent)).toEqual(["chore", "backend", "regression"]);
    expect(new Set(labels.map((label) => label.className)).size).toBe(1);
  });

  it("gives every card the same styling, whichever column or project it belongs to", () => {
    const { container } = renderBoard();

    const faces = cardRows(container).map((row) => row.querySelector("a[href]")?.parentElement?.className);

    expect(new Set(faces).size).toBe(1);
  });

  it("gives every lane heading the same styling, so only its name tells it apart", () => {
    const { container } = renderBoard();

    const headings = [...container.querySelectorAll<HTMLElement>("h2")];

    expect(headings.map((heading) => heading.textContent)).toEqual(["Backlog", "In Progress", "Done"]);
    expect(new Set(headings.map((heading) => heading.className)).size).toBe(1);
  });

  it("renders no swatch and no identifying colour anywhere on the board", () => {
    const { container } = renderBoard();

    const coloured = [...container.querySelectorAll("*")].filter((element) => identityColour(element) !== "");

    expect(coloured.map((element) => element.outerHTML.slice(0, 120))).toEqual([]);
  });
});