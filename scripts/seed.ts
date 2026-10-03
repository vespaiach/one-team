import { existsSync } from "node:fs";
import postgres from "postgres";
import { readSettings } from "../src/server/config.ts";

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
  const sql = postgres(readSettings().databaseUrl, { onnotice: () => {} });
  try {
    let added = 0;
    for (const member of members) {
      const rows = await sql`
        insert into members (email, full_name, username, role, active)
        values (${member.email}, ${member.fullName}, ${member.username}, ${member.role}, ${member.active})
        on conflict do nothing
        returning id
      `;
      added += rows.length;
    }
    process.stdout.write(`Added ${added} members\n`);
  } finally {
    await sql.end();
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}