import { existsSync } from "node:fs";
import { readSettings } from "../src/server/config.ts";
import { connect } from "../src/server/db.ts";
import { members as membersTable } from "../src/server/schema.ts";

type SeedMember = {
  email: string;
  fullName: string;
  username: string;
  role: "admin" | "member";
  active: boolean;
};

const memberNames = [
  "Ada Lovelace",
  "Alan Turing",
  "Grace Hopper",
  "Edsger Dijkstra",
  "Barbara Liskov",
  "Donald Knuth",
  "Margaret Hamilton",
  "Ken Thompson",
  "Frances Allen",
  "Dennis Ritchie",
  "Radia Perlman",
  "John Backus",
  "Katherine Johnson",
  "Tony Hoare",
];

const members: SeedMember[] = [
  { email: "owner@example.com", fullName: "Owner Name", username: "owner", role: "admin", active: true },
  ...memberNames.map((fullName, index) => {
    const username = fullName.toLowerCase().replace(" ", "-");
    return {
      email: `${username}@example.com`,
      fullName,
      username,
      role: "member" as const,
      active: index !== memberNames.length - 1,
    };
  }),
];

if (existsSync(".env.local")) {
  process.loadEnvFile(".env.local");
}

try {
  const db = connect(readSettings().databaseUrl);
  try {
    let added = 0;
    for (const member of members) {
      const rows = await db
        .insert(membersTable)
        .values(member)
        .onConflictDoNothing()
        .returning({ id: membersTable.id });
      added += rows.length;
    }
    process.stdout.write(`Added ${added} members\n`);
  } finally {
    await db.$client.end();
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}