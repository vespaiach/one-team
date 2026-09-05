export type SeedUser = {
  firstName: string;
  lastName: string;
  email: string;
  role: "admin" | "member";
  jobTitle: string;
  slackHandle: string;
  phone: string;
  bio: string;
};

export type SeedProject = {
  key: string;
  name: string;
  description: string;
  status: "active" | "archived";
  startDate: string;
  targetDate: string;
};

export const SEED_USERS: SeedUser[] = [
  {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "ada.lovelace@one-team.test",
    role: "admin",
    jobTitle: "Head of Engineering",
    slackHandle: "@ada",
    phone: "+1 555 0100",
    bio: "Runs the engineering org and keeps the roadmap honest.",
  },
  {
    firstName: "Grace",
    lastName: "Hopper",
    email: "grace.hopper@one-team.test",
    role: "member",
    jobTitle: "Principal Engineer",
    slackHandle: "@grace",
    phone: "+1 555 0101",
    bio: "Compiler nerd, allergic to undocumented behaviour.",
  },
  {
    firstName: "Alan",
    lastName: "Turing",
    email: "alan.turing@one-team.test",
    role: "member",
    jobTitle: "Staff Backend Engineer",
    slackHandle: "@alan",
    phone: "+1 555 0102",
    bio: "Works on the scheduling core and the data model.",
  },
  {
    firstName: "Katherine",
    lastName: "Johnson",
    email: "katherine.johnson@one-team.test",
    role: "member",
    jobTitle: "Data Engineer",
    slackHandle: "@katherine",
    phone: "+1 555 0103",
    bio: "Owns reporting pipelines and the metrics warehouse.",
  },
  {
    firstName: "Linus",
    lastName: "Carlsen",
    email: "linus.carlsen@one-team.test",
    role: "member",
    jobTitle: "Platform Engineer",
    slackHandle: "@linus",
    phone: "+1 555 0104",
    bio: "Keeps CI green and the deploy pipeline boring.",
  },
  {
    firstName: "Mira",
    lastName: "Okafor",
    email: "mira.okafor@one-team.test",
    role: "member",
    jobTitle: "Product Designer",
    slackHandle: "@mira",
    phone: "+1 555 0105",
    bio: "Designs the board and issue surfaces end to end.",
  },
  {
    firstName: "Tomas",
    lastName: "Bergqvist",
    email: "tomas.bergqvist@one-team.test",
    role: "member",
    jobTitle: "Frontend Engineer",
    slackHandle: "@tomas",
    phone: "+1 555 0106",
    bio: "Accessibility advocate, React Aria maintainer at heart.",
  },
  {
    firstName: "Priya",
    lastName: "Raghavan",
    email: "priya.raghavan@one-team.test",
    role: "member",
    jobTitle: "Engineering Manager",
    slackHandle: "@priya",
    phone: "+1 555 0107",
    bio: "Runs delivery for the payments and billing streams.",
  },
  {
    firstName: "Diego",
    lastName: "Marchetti",
    email: "diego.marchetti@one-team.test",
    role: "member",
    jobTitle: "QA Engineer",
    slackHandle: "@diego",
    phone: "+1 555 0108",
    bio: "Breaks things on purpose so customers do not by accident.",
  },
  {
    firstName: "Noor",
    lastName: "Haddad",
    email: "noor.haddad@one-team.test",
    role: "member",
    jobTitle: "Support Lead",
    slackHandle: "@noor",
    phone: "+1 555 0109",
    bio: "Closest to the customer, loudest about regressions.",
  },
];

export const SEED_PROJECTS: SeedProject[] = [
  {
    key: "APOLLO",
    name: "Apollo Platform",
    description: "The shared services layer every product team builds on.",
    status: "active",
    startDate: "2026-01-05",
    targetDate: "2026-12-18",
  },
  {
    key: "WEB",
    name: "Marketing Website",
    description: "Public site, pricing pages, and the docs shell.",
    status: "active",
    startDate: "2026-02-02",
    targetDate: "2026-08-28",
  },
  {
    key: "APP",
    name: "Workspace App",
    description: "The signed-in product surface: boards, issues, and the feed.",
    status: "active",
    startDate: "2026-01-12",
    targetDate: "2026-11-27",
  },
  {
    key: "PAY",
    name: "Payments and Billing",
    description: "Subscriptions, invoicing, dunning, and tax handling.",
    status: "active",
    startDate: "2026-03-02",
    targetDate: "2026-10-30",
  },
  {
    key: "MOBILE",
    name: "Mobile Companion",
    description: "The read-mostly phone client for boards and notifications.",
    status: "active",
    startDate: "2026-04-06",
    targetDate: "2026-12-11",
  },
  {
    key: "DATA",
    name: "Analytics Warehouse",
    description: "Event ingestion, modelling, and the internal metrics dashboards.",
    status: "active",
    startDate: "2026-02-16",
    targetDate: "2026-09-25",
  },
  {
    key: "INFRA",
    name: "Infrastructure Hardening",
    description: "Deploys, backups, observability, and the on-call rotation.",
    status: "active",
    startDate: "2026-01-19",
    targetDate: "2026-07-31",
  },
  {
    key: "DESIGN",
    name: "Design System",
    description: "Accessible primitives, tokens, and the component documentation.",
    status: "active",
    startDate: "2026-03-16",
    targetDate: "2026-11-13",
  },
  {
    key: "SUPPORT",
    name: "Customer Support Desk",
    description: "Ticket triage, macros, and the escalation path into engineering.",
    status: "archived",
    startDate: "2025-05-05",
    targetDate: "2025-12-19",
  },
  {
    key: "GROWTH",
    name: "Growth Experiments",
    description: "Onboarding funnels, referral loops, and pricing experiments.",
    status: "archived",
    startDate: "2025-08-04",
    targetDate: "2026-01-30",
  },
];

export const SEED_LABELS = [
  "bug",
  "feature",
  "chore",
  "documentation",
  "design",
  "performance",
  "security",
  "regression",
];

export const SEED_ISSUE_TITLES = [
  "Sign-in throttle counts failed attempts twice",
  "Board columns lose their order after a drag",
  "Add keyboard shortcuts to the issue detail panel",
  "Comment mentions do not notify deactivated members",
  "Reduce first contentful paint on the board route",
  "Write the runbook for a failed migration",
  "Invite emails render broken links in Outlook",
  "Archive a project without dropping its activity feed",
  "Due-date picker rejects valid leap-year dates",
  "Split the settings page into focused sections",
  "Rate limit the password reset endpoint by IP",
  "Backfill missing issue counters for legacy projects",
  "Empty board state needs a real illustration",
  "Label deletion should not cascade into issue history",
  "Session cookie is not marked SameSite=Lax",
  "Paginate the activity feed beyond the first hundred rows",
];

export const SEED_ISSUE_DESCRIPTIONS = [
  "Reproduced on staging with two browser profiles. Needs a regression test before the fix lands.",
  "Reported by support twice this week. The workaround is a hard refresh, which is not acceptable.",
  "Scoped during planning. Behind the current milestone but ahead of the next one.",
  "Blocked on the schema change landing first. Revisit once the migration is applied.",
  "Small change, but it touches a validated input boundary so it needs server-side coverage.",
  null,
];

export const SEED_COMMENT_BODIES = [
  "Picked this up, should have a branch by the end of the day.",
  "I can reproduce it, but only when the project has more than five columns.",
  "Moved this out of the current milestone. It is real, but it is not urgent.",
  "Added a failing test first so we can see it go green.",
  "Anyone got context on why this behaved differently before the migration?",
  "Deployed to staging. Please have a look before I promote it.",
  "Closing the loop: the root cause was a missing index on the join column.",
  "This one needs a design review before we commit to the interaction.",
];

export const SEED_PROJECT_COMMENT_BODIES = [
  "Kickoff notes are in the shared doc. Milestones are on the roadmap.",
  "Heads up, we are pulling the target date forward by two weeks.",
  "Retro takeaway: smaller issues, earlier reviews, fewer surprises.",
];