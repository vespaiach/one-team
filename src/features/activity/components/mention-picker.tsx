"use client";

import type { RefObject } from "react";
import { useEffect, useState } from "react";
import { ListBox, ListBoxItem } from "react-aria-components/ListBox";
import { Popover } from "react-aria-components/Popover";
import type { MentionCandidate, MentionCandidateGroups, MentionTarget } from "../server/mention-queries";

export type { MentionCandidate };

const DEFAULT_DEBOUNCE_MS = 300;
const EMPTY_GROUPS: MentionCandidateGroups = { scoped: [], everyoneElse: [] };

function matchesQuery(candidate: MentionCandidate, query: string): boolean {
  const trimmed = query.trim().toLowerCase();
  if (trimmed === "") {
    return true;
  }
  return `${candidate.firstName} ${candidate.lastName}`.toLowerCase().includes(trimmed);
}

export function MentionPicker({
  target,
  query,
  triggerRef,
  listCandidates,
  onSelect,
  onClose,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: {
  target: MentionTarget;
  query: string;
  triggerRef: RefObject<Element | null>;
  listCandidates: (target: MentionTarget) => Promise<MentionCandidateGroups>;
  onSelect: (candidate: MentionCandidate) => void;
  onClose: () => void;
  debounceMs?: number;
}) {
  const [groups, setGroups] = useState<MentionCandidateGroups>(EMPTY_GROUPS);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `query` drives the debounce restart on every keystroke even though the callback body only reads `target`.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      listCandidates(target).then((result) => {
        if (!cancelled) {
          setGroups(result);
        }
      });
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [target, query, debounceMs, listCandidates]);

  const candidates = [...groups.scoped, ...groups.everyoneElse].filter((candidate) =>
    matchesQuery(candidate, query),
  );

  return (
    <Popover
      isOpen
      triggerRef={triggerRef}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose();
        }
      }}
      className="min-w-[200px] border border-(--color-divider) bg-(--color-surface) py-1 shadow-lg">
      <ListBox
        aria-label="Mention suggestions"
        renderEmptyState={() => (
          <div className="px-3 py-1.5 text-label text-(--color-text-muted)">No matches</div>
        )}
        className="outline-none">
        {candidates.map((candidate) => (
          <ListBoxItem
            key={candidate.id}
            id={candidate.id}
            textValue={`${candidate.firstName} ${candidate.lastName}`}
            onAction={() => onSelect(candidate)}
            className="cursor-default px-3 py-1.5 text-control text-(--color-text) data-[hovered]:bg-(--color-surface-hover) data-[focus-visible]:outline-2 data-[focus-visible]:outline-(--color-accent)">
            {candidate.firstName} {candidate.lastName}
          </ListBoxItem>
        ))}
      </ListBox>
    </Popover>
  );
}