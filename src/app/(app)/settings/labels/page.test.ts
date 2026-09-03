import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/auth/server/actor", () => ({
  requireActor: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  forbidden: vi.fn(() => {
    throw new Error("NEXT_FORBIDDEN");
  }),
}));
vi.mock("@/features/labels/server/queries", () => ({
  listLabelsWithUsage: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/features/labels/actions", () => ({
  createLabel: vi.fn(),
  updateLabel: vi.fn(),
  deleteLabel: vi.fn(),
  checkLabelNameAvailable: vi.fn(),
}));

import { forbidden } from "next/navigation";
import { requireActor } from "@/features/auth/server/actor";
import { listLabelsWithUsage } from "@/features/labels/server/queries";
import LabelsPage from "./page";

const ADMIN = {
  id: "admin-1",
  role: "admin",
  firstName: "Ada",
  lastName: "Lovelace",
  avatarUrl: null,
  mustChangePassword: false,
};

const MEMBER = {
  id: "member-1",
  role: "member",
  firstName: "Grace",
  lastName: "Hopper",
  avatarUrl: null,
  mustChangePassword: false,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("/settings/labels page (FR-001, research D-1, D-7)", () => {
  it("redirects an unauthenticated caller to /signin and never reaches Forbidden", async () => {
    vi.mocked(requireActor).mockImplementation(() => {
      throw new Error("NEXT_REDIRECT:/signin");
    });

    await expect(LabelsPage()).rejects.toThrow("NEXT_REDIRECT:/signin");
    expect(forbidden).not.toHaveBeenCalled();
  });

  it("gives a signed-in non-admin the Forbidden screen, without ever running the query", async () => {
    vi.mocked(requireActor).mockResolvedValue(MEMBER);

    await expect(LabelsPage()).rejects.toThrow("NEXT_FORBIDDEN");

    expect(forbidden).toHaveBeenCalled();
    expect(listLabelsWithUsage).not.toHaveBeenCalled();
  });

  it("renders the screen for a signed-in admin", async () => {
    vi.mocked(requireActor).mockResolvedValue(ADMIN);

    const jsx = await LabelsPage();

    expect(jsx).toBeDefined();
    expect(forbidden).not.toHaveBeenCalled();
  });

  it("the guard runs before the query is ever constructed in the page's own body (research D-7)", () => {
    const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
    const pageFunctionIndex = source.indexOf("export default async function LabelsPage");
    expect(pageFunctionIndex).toBeGreaterThan(-1);
    const pageFunctionBody = source.slice(pageFunctionIndex);

    const guardIndex = pageFunctionBody.indexOf("requireActor(");
    const suspenseIndex = pageFunctionBody.indexOf("<Suspense");
    expect(guardIndex).toBeGreaterThan(-1);
    expect(suspenseIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(suspenseIndex);

    expect(pageFunctionBody.indexOf("listLabelsWithUsage(")).toBe(-1);
    expect(source).toContain("listLabelsWithUsage(");
  });
});