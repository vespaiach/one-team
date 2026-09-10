import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityRow as ActivitySentence } from "@/features/activity/components/activity-row";
import type { ActivityType } from "@/features/activity/server/write-activity";
import type { InstallationActivityRow } from "../server/activity-queries";
import { ActivityRow } from "./activity-row";

const SOURCE = readFileSync(
  join(process.cwd(), "src", "features", "home", "components", "activity-row.tsx"),
  "utf8",
);

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

const NON_COMMENT_TYPES: Exclude<ActivityType, "comment">[] = [
  "created",
  "field_changed",
  "member_added",
  "member_removed",
  "archived",
  "reopened",
  "column_added",
  "column_renamed",
  "column_reordered",
  "column_deleted",
];

function row(overrides: Partial<InstallationActivityRow> = {}): InstallationActivityRow {
  return {
    id: "a1",
    kind: "created",
    actor: {
      id: "u1",
      firstName: "Alan",
      lastName: "Turing",
      avatarUrl: null,
      role: "member",
      jobTitle: null,
      deactivatedAt: null,
    },
    targetLabel: "WEB-142 · Fix the header",
    projectName: "Website Redesign",
    href: "/projects/WEB/issues/142/details",
    createdAt: new Date(Date.now() - TWO_HOURS_MS),
    field: "priority",
    fromValue: "low",
    toValue: "high",
    ...overrides,
  };
}

describe("ActivityRow composes R7's sentence for the ten non-comment types (FR-030, C-5)", () => {
  it.each(NON_COMMENT_TYPES)("renders R7's own sentence for %s", (type) => {
    const data = row({ kind: type });

    const { container: expected } = render(
      <ActivitySentence
        actor={data.actor}
        type={type}
        field={data.field}
        fromValue={data.fromValue}
        toValue={data.toValue}
      />,
    );
    const sentence = expected.textContent ?? "";

    const { container: actual } = render(<ActivityRow row={data} />);

    expect(sentence.length).toBeGreaterThan(0);
    expect(actual.textContent).toContain(sentence);
  });

  it("composes R7's component rather than reimplementing its sentence", () => {
    expect(SOURCE).toMatch(/from "@\/features\/activity\/components\/activity-row"/);
    expect(SOURCE).not.toMatch(/switch \(/);
    expect(SOURCE).not.toMatch(/changed .* from/);
  });

  it("names the target, the project and a relative time beside the sentence", () => {
    render(<ActivityRow row={row({ kind: "created" })} />);

    expect(screen.getByText("WEB-142 · Fix the header")).not.toBeNull();
    expect(screen.getByText("Website Redesign")).not.toBeNull();
    expect(screen.getByText("2 hours ago")).not.toBeNull();
  });

  it("shows the actor's avatar as decorative — the visible sentence carries the meaning", () => {
    const { container } = render(
      <ActivityRow row={row({ actor: { ...row().actor, avatarUrl: "https://example.com/at.png" } })} />,
    );

    const avatar = container.querySelector("img");
    expect(avatar?.getAttribute("aria-hidden")).toBe("true");
  });

  it("names a project-scoped event by its project once, not twice", () => {
    render(
      <ActivityRow
        row={row({
          kind: "archived",
          targetLabel: "Website Redesign",
          projectName: "Website Redesign",
          href: "/projects/WEB",
        })}
      />,
    );

    expect(screen.getAllByText("Website Redesign")).toHaveLength(1);
  });
});

describe("ActivityRow renders a comment without its body (FR-029, FR-030, research E-3)", () => {
  const commentRow = row({
    kind: "comment",
    id: "c1",
    field: null,
    fromValue: null,
    toValue: null,
  });

  it("reads actor, commented on, target and a relative time", () => {
    render(<ActivityRow row={commentRow} />);

    expect(screen.getByText("Alan Turing")).not.toBeNull();
    expect(screen.getByText("commented on")).not.toBeNull();
    expect(screen.getByText("WEB-142 · Fix the header")).not.toBeNull();
    expect(screen.getByText("2 hours ago")).not.toBeNull();
  });

  it("renders no comment body and reaches for no markdown renderer", () => {
    expect(SOURCE).not.toMatch(/components\/shared\/markdown/);
    expect(SOURCE).not.toMatch(/\bbody\b/);
  });
});

describe("ActivityRow navigates and never mutates (FR-042, E-1)", () => {
  it("is a native anchor to the row's own href", () => {
    render(<ActivityRow row={row()} />);

    const link = screen.getByRole("link");
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("/projects/WEB/issues/142/details");
  });

  it("takes focus and keeps the application's visible focus indicator", () => {
    render(<ActivityRow row={row()} />);

    const link = screen.getByRole("link");
    link.focus();

    expect(document.activeElement).toBe(link);
    expect(link.className).not.toMatch(/outline-none|focus:outline-none/);
  });

  it("is a Server Component with no control on it", () => {
    render(<ActivityRow row={row()} />);

    expect(SOURCE).not.toMatch(/"use client"/);
    expect(screen.queryByRole("button")).toBeNull();
  });
});