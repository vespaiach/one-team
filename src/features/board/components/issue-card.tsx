import Link from "next/link";
import type { IssuePriority } from "@/features/issues/server/input";
import { displayName } from "@/lib/display-name";
import type { BoardCard, BoardPerson } from "../server/board-queries";

type SetPriority = Exclude<IssuePriority, "none">;

const PRIORITY_NAMES: Record<SetPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  urgent: "Urgent",
};

const PRIORITY_GLYPHS: Record<SetPriority, string> = {
  low: "▁",
  medium: "▄",
  high: "▆",
  urgent: "█",
};

function issuePath(projectKey: string, issueKey: string): string {
  const issueNumber = issueKey.slice(issueKey.lastIndexOf("-") + 1);
  return `/projects/${projectKey}/issues/${issueNumber}/details`;
}

function AssigneeAvatar({ person }: { person: BoardPerson }) {
  const name = displayName(person);

  if (person.avatarUrl === null) {
    return <span className="text-label text-(--color-text-muted)">{name}</span>;
  }

  return (
    // biome-ignore lint/performance/noImgElement: avatarUrl is an arbitrary external URL, not an allow-listable domain for next/image
    <img
      src={person.avatarUrl}
      alt={name}
      className="h-6 w-6 flex-none object-cover"
    />
  );
}

export function IssueCard({ card, projectKey }: { card: BoardCard; projectKey: string }) {
  const showsMeta =
    card.priority !== "none" || card.dueDate !== null || card.commentCount > 0 || card.assignee !== null;

  return (
    <div className="flex flex-col gap-2 border border-(--color-divider) bg-(--color-surface) p-3">
      <Link
        href={issuePath(projectKey, card.key)}
        aria-label={`${card.key} ${card.title}`}
        className="flex flex-col gap-1">
        <span className="text-label text-(--color-text-muted)">{card.key}</span>
        <span className="text-control text-(--color-text)">{card.title}</span>
      </Link>
      {card.labels.length > 0 ? (
        <ul className="flex flex-wrap gap-1">
          {card.labels.map((label) => (
            <li
              key={label.id}
              className="border border-(--color-divider) px-1.5 text-label text-(--color-text-muted)">
              {label.name}
            </li>
          ))}
        </ul>
      ) : null}
      {showsMeta ? (
        <div className="flex items-center gap-2">
          {card.priority !== "none" ? (
            <span
              role="img"
              aria-label={`Priority: ${PRIORITY_NAMES[card.priority]}`}
              className="text-label text-(--color-text)">
              {PRIORITY_GLYPHS[card.priority]}
            </span>
          ) : null}
          {card.dueDate !== null ? (
            <span className="text-label text-(--color-text-muted)">{card.dueDate}</span>
          ) : null}
          {card.commentCount > 0 ? (
            <span className="text-label text-(--color-text-muted)">
              {card.commentCount === 1 ? "1 comment" : `${card.commentCount} comments`}
            </span>
          ) : null}
          {card.assignee !== null ? <AssigneeAvatar person={card.assignee} /> : null}
        </div>
      ) : null}
    </div>
  );
}