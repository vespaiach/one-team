import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { label } from "@/db/schema";
import { truncateTestDatabase } from "@/db/test-database";
import { countLabels } from "./queries";

const NOW = new Date("2026-01-01T00:00:00Z");

beforeEach(async () => {
  await truncateTestDatabase();
});

afterEach(async () => {
  await truncateTestDatabase();
});

describe("countLabels", () => {
  it("counts every label", async () => {
    await db.insert(label).values([
      { name: "blocked", createdAt: NOW, updatedAt: NOW },
      { name: "urgent", createdAt: NOW, updatedAt: NOW },
    ]);

    expect(await countLabels()).toBe(2);
  });

  it("is zero when there are no labels", async () => {
    expect(await countLabels()).toBe(0);
  });
});