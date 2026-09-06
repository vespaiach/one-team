import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { BoardCard } from "../server/board-queries";
import { IssueCard } from "./issue-card";

const BARE_CARD: BoardCard = {
  id: "0198d2b1-0000-7000-8000-000000000001",
  key: "WEB-7",
  title: "Rework the sign-in copy",
  columnId: "0198d2b1-0000-7000-8000-0000000000c1",
  assigneeId: null,
  priority: "none",
  dueDate: null,
  labels: [],
  assignee: null,
  commentCount: 0,
  order: 0,
};

const ADA = {
  id: "0198d2b1-0000-7000-8000-0000000000a1",
  firstName: "Ada",
  lastName: "Lovelace",
  avatarUrl: "https://example.test/ada.png",
};

describe("IssueCard — the face it always shows (FR-010, FR-012)", () => {
  it("shows the issue's key and its title", () => {
    render(
      <IssueCard
        card={BARE_CARD}
        projectKey="WEB"
      />,
    );

    expect(screen.getByText("WEB-7")).toBeDefined();
    expect(screen.getByText("Rework the sign-in copy")).toBeDefined();
  });

  it("renders the DTO's key string as-is, never recomputing or reformatting it", () => {
    render(
      <IssueCard
        card={{ ...BARE_CARD, key: "LEGACY-42" }}
        projectKey="WEB"
      />,
    );

    expect(screen.getByText("LEGACY-42")).toBeDefined();
    expect(screen.queryByText("WEB-42")).toBeNull();
  });
});

describe("IssueCard — an unset field renders nothing at all (FR-010)", () => {
  it("shows the key and the title and no other text when nothing optional is set", () => {
    const { container } = render(
      <IssueCard
        card={BARE_CARD}
        projectKey="WEB"
      />,
    );

    expect(container.textContent).toBe("WEB-7Rework the sign-in copy");
  });

  it("renders no placeholder, no empty slot and no chip for an unset field", () => {
    render(
      <IssueCard
        card={BARE_CARD}
        projectKey="WEB"
      />,
    );

    expect(screen.queryByText(/unassigned/i)).toBeNull();
    expect(screen.queryByText(/no priority/i)).toBeNull();
    expect(screen.queryByText(/none/i)).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("IssueCard — the priority glyph (FR-010)", () => {
  it("shows a glyph carrying the priority's name when a priority is set", () => {
    render(
      <IssueCard
        card={{ ...BARE_CARD, priority: "high" }}
        projectKey="WEB"
      />,
    );

    expect(screen.getByRole("img", { name: "Priority: High" })).toBeDefined();
  });

  it("shows no glyph at all when the priority is none", () => {
    render(
      <IssueCard
        card={BARE_CARD}
        projectKey="WEB"
      />,
    );

    expect(screen.queryByRole("img", { name: /priority/i })).toBeNull();
  });
});

describe("IssueCard — labels are told apart by name alone (FR-011, SC-016)", () => {
  it("shows each label's name and nothing else about it", () => {
    render(
      <IssueCard
        card={{
          ...BARE_CARD,
          labels: [
            { id: "0198d2b1-0000-7000-8000-0000000000b1", name: "bug" },
            { id: "0198d2b1-0000-7000-8000-0000000000b2", name: "needs design" },
          ],
        }}
        projectKey="WEB"
      />,
    );

    expect(screen.getByText("bug").textContent).toBe("bug");
    expect(screen.getByText("needs design").textContent).toBe("needs design");
  });

  it("carries no colour swatch for a label and no colour identifying a project or a column", () => {
    const { container } = render(
      <IssueCard
        card={{
          ...BARE_CARD,
          labels: [{ id: "0198d2b1-0000-7000-8000-0000000000b1", name: "bug" }],
        }}
        projectKey="WEB"
      />,
    );

    expect(container.querySelector("[style]")).toBeNull();
    expect(container.querySelector("[data-swatch]")).toBeNull();
    expect(container.querySelector("[data-colour]")).toBeNull();
  });

  it("renders no label region when the issue carries no label", () => {
    const { container } = render(
      <IssueCard
        card={BARE_CARD}
        projectKey="WEB"
      />,
    );

    expect(container.querySelector("ul")).toBeNull();
  });
});

describe("IssueCard — the assignee's avatar (FR-010)", () => {
  it("shows the assignee's avatar named for that person when an assignee is set", () => {
    render(
      <IssueCard
        card={{ ...BARE_CARD, assigneeId: ADA.id, assignee: ADA }}
        projectKey="WEB"
      />,
    );

    const avatar = screen.getByRole("img", { name: "Ada Lovelace" });
    expect(avatar.getAttribute("src")).toBe("https://example.test/ada.png");
  });

  it("falls back to the assignee's name when that person carries no avatar", () => {
    render(
      <IssueCard
        card={{ ...BARE_CARD, assigneeId: ADA.id, assignee: { ...ADA, avatarUrl: null } }}
        projectKey="WEB"
      />,
    );

    expect(screen.getByText("Ada Lovelace")).toBeDefined();
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("shows nothing where the avatar would sit when no one is assigned", () => {
    render(
      <IssueCard
        card={BARE_CARD}
        projectKey="WEB"
      />,
    );

    expect(screen.queryByRole("img")).toBeNull();
  });
});

describe("IssueCard — the due date and the comment count (FR-010)", () => {
  it("shows the due date only when one is set", () => {
    const { rerender } = render(
      <IssueCard
        card={{ ...BARE_CARD, dueDate: "2026-09-30" }}
        projectKey="WEB"
      />,
    );

    expect(screen.getByText("2026-09-30")).toBeDefined();

    rerender(
      <IssueCard
        card={BARE_CARD}
        projectKey="WEB"
      />,
    );

    expect(screen.queryByText("2026-09-30")).toBeNull();
  });

  it("shows the comment count only when the issue carries comments", () => {
    const { rerender } = render(
      <IssueCard
        card={{ ...BARE_CARD, commentCount: 3 }}
        projectKey="WEB"
      />,
    );

    expect(screen.getByText("3 comments")).toBeDefined();

    rerender(
      <IssueCard
        card={BARE_CARD}
        projectKey="WEB"
      />,
    );

    expect(screen.queryByText(/comment/i)).toBeNull();
  });
});

describe("IssueCard — activating it opens the issue's own page (FR-013)", () => {
  it("offers a link to that issue's full page URL, named by its key and title", () => {
    render(
      <IssueCard
        card={BARE_CARD}
        projectKey="WEB"
      />,
    );

    const link = screen.getByRole("link", { name: "WEB-7 Rework the sign-in copy" });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/projects/WEB/issues/7/details");
  });

  it("never opens a peek panel over the board", () => {
    render(
      <IssueCard
        card={BARE_CARD}
        projectKey="WEB"
      />,
    );

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });
});