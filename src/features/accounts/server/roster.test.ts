import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { user } from "@/db/schema";
import { truncateTestDatabase } from "@/db/test-database";
import { countActiveUsers, countUsers } from "./roster";

const NOW = new Date("2026-01-01T00:00:00Z");

beforeEach(async () => {
  await truncateTestDatabase();
});

afterEach(async () => {
  await truncateTestDatabase();
});

describe("countUsers and countActiveUsers", () => {
  it("counts every account, and separately only the active ones", async () => {
    await db.insert(user).values([
      { firstName: "Ada", lastName: "Lovelace", email: "ada@example.com", createdAt: NOW, updatedAt: NOW },
      {
        firstName: "Grace",
        lastName: "Hopper",
        email: "grace@example.com",
        deactivatedAt: NOW,
        createdAt: NOW,
        updatedAt: NOW,
      },
    ]);

    expect(await countUsers()).toBe(2);
    expect(await countActiveUsers()).toBe(1);
  });

  it("is zero for both when there are no accounts", async () => {
    expect(await countUsers()).toBe(0);
    expect(await countActiveUsers()).toBe(0);
  });
});