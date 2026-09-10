import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { InstallationActivityRow } from "../server/activity-queries";

const { listInstallationActivity } = vi.hoisted(() => ({ listInstallationActivity: vi.fn() }));
vi.mock("../server/activity-queries", () => ({ listInstallationActivity }));

const { ActivitySection } = await import("./activity-section");

function row(overrides: Partial<InstallationActivityRow> = {}): InstallationActivityRow {
  return {
    id: "a1",
    kind: "created",
    actor: {
      id: "u1",
      firstName: "Grace",
      lastName: "Hopper",
      avatarUrl: null,
      role: "member",
      jobTitle: null,
      deactivatedAt: null,
    },
    targetLabel: "APOLLO-1 · Fix the flux capacitor",
    projectName: "Apollo Platform",
    href: "/projects/APOLLO/issues/1/details",
    createdAt: new Date(),
    field: null,
    fromValue: null,
    toValue: null,
    body: null,
    ...overrides,
  };
}

describe("ActivitySection", () => {
  it("shows the heading and every activity row", async () => {
    listInstallationActivity.mockResolvedValue([row()]);

    render(await ActivitySection());

    expect(screen.getByText("Team activity")).toBeTruthy();
    expect(screen.getByText("Grace Hopper")).toBeTruthy();
  });

  it("shows a placeholder when nothing has happened yet", async () => {
    listInstallationActivity.mockResolvedValue([]);

    render(await ActivitySection());

    expect(screen.getByText("Nothing has happened yet.")).toBeTruthy();
  });
});