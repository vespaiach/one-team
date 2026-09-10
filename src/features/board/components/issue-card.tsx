import clsx from "clsx";
import { Button } from "react-aria-components/Button";
import { Pill } from "@/components/ui/pill";
import { PriorityGlyph } from "@/components/ui/priority-glyph";
import { displayName } from "@/lib/display-name";
import type { BoardCard, BoardPerson } from "../server/board-queries";

function AssigneeAvatar({ person }: { person: BoardPerson }) {
  const name = displayName(person);

  if (person.avatarUrl === null) {
    return (
      <span className="grid h-4.5 w-4.5 flex-none place-items-center rounded-full bg-(--color-accent-200) font-mono text-[9px] text-(--color-accent-900)">
        {name
          .split(" ")
          .map((part) => part[0])
          .join("")}
      </span>
    );
  }

  return (
    // biome-ignore lint/performance/noImgElement: avatarUrl is an arbitrary external URL, not an allow-listable domain for next/image
    <img
      src={person.avatarUrl}
      alt={name}
      className="h-4.5 w-4.5 flex-none rounded-full object-cover"
    />
  );
}

export function IssueCard({
  card,
  isSelected = false,
  onSelect,
}: {
  card: BoardCard;
  isSelected?: boolean;
  onSelect: (card: BoardCard) => void;
}) {
  return (
    <Button
      onPress={() => onSelect(card)}
      aria-current={isSelected ? "true" : undefined}
      className={clsx(
        "grid gap-1.5 border bg-(--color-bg) p-2.5 text-start",
        "data-[hovered]:border-(--color-border-control)",
        "data-[focus-visible]:outline-2 data-[focus-visible]:outline-(--color-accent)",
        "group-data-[dragging]:rotate-[-1.4deg] group-data-[dragging]:border-(--color-accent) group-data-[dragging]:shadow-md",
        isSelected ? "border-(--color-accent)" : "border-(--color-divider)",
      )}>
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-(--color-text-muted) text-caption">{card.key}</span>
        {card.assignee !== null ? (
          <span className="ml-auto">
            <AssigneeAvatar person={card.assignee} />
          </span>
        ) : null}
      </div>
      <h3 className="text-(--color-text) text-control leading-snug">{card.title}</h3>
      <div className="flex flex-wrap items-center gap-1.5">
        {card.priority !== "none" ? <PriorityGlyph priority={card.priority} /> : null}
        {card.labels.map((label) => (
          <Pill
            key={label.id}
            variant="label">
            {label.name}
          </Pill>
        ))}
        {card.dueDate !== null ? (
          <span className="font-mono text-(--color-text-muted) text-caption">{card.dueDate}</span>
        ) : null}
        {card.commentCount > 0 ? (
          <span className="font-mono text-(--color-text-muted) text-caption">{card.commentCount}</span>
        ) : null}
      </div>
    </Button>
  );
}