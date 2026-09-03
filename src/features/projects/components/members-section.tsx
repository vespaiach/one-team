import type { RosterEntry } from "../server/queries";

export function MembersSection({ roster }: { roster: RosterEntry[] }) {
  return (
    <ul>
      {roster.map((entry) => (
        <li key={entry.userId}>{entry.displayName}</li>
      ))}
    </ul>
  );
}