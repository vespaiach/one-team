import type { DropItem } from "react-aria-components";
import { Button } from "react-aria-components/Button";
import { GridList, GridListItem } from "react-aria-components/GridList";
import { DropIndicator, useDragAndDrop } from "react-aria-components/useDragAndDrop";
import type { ColumnKind } from "@/components/ui/status-glyph";
import { StatusGlyph } from "@/components/ui/status-glyph";
import type { Drop, DropPlacement, Lane } from "../lane-model";
import type { BoardCard } from "../server/board-queries";
import { CardComposer, type CardComposerProps } from "./card-composer";
import { IssueCard } from "./issue-card";

const BOARD_CARD_DRAG_TYPE = "application/x-one-team-board-card";

function placementOf(dropPosition: "before" | "after" | "on"): DropPlacement {
  return dropPosition === "before" ? "before" : "after";
}

async function draggedIssueId(items: DropItem[]): Promise<string | null> {
  const [item] = items;
  if (item === undefined || item.kind !== "text" || !item.types.has(BOARD_CARD_DRAG_TYPE)) {
    return null;
  }
  return item.getText(BOARD_CARD_DRAG_TYPE);
}

export function BoardLane({
  lane,
  onDrop,
  onSelect,
  selectedIssueId,
  composer,
  canWrite = true,
  statusKind,
}: {
  lane: Lane<BoardCard> & { canAcceptDrop?: boolean };
  onDrop?: (drop: Drop) => void;
  onSelect: (card: BoardCard) => void;
  selectedIssueId?: string | null;
  composer?: CardComposerProps;
  canWrite?: boolean;
  statusKind?: ColumnKind;
}) {
  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => [...keys].map((key) => ({ [BOARD_CARD_DRAG_TYPE]: String(key) })),
    acceptedDragTypes: [BOARD_CARD_DRAG_TYPE],
    getDropOperation: () => (lane.canAcceptDrop === false ? "cancel" : "move"),
    onReorder: ({ keys, target }) => {
      const [issueId] = [...keys].map(String);
      if (onDrop === undefined || issueId === undefined || target.type !== "item") {
        return;
      }
      onDrop({
        issueId,
        laneId: lane.id,
        targetIssueId: String(target.key),
        placement: placementOf(target.dropPosition),
      });
    },
    onInsert: async ({ items, target }) => {
      const issueId = await draggedIssueId(items);
      if (onDrop === undefined || issueId === null || target.type !== "item") {
        return;
      }
      onDrop({
        issueId,
        laneId: lane.id,
        targetIssueId: String(target.key),
        placement: placementOf(target.dropPosition),
      });
    },
    onRootDrop: async ({ items }) => {
      const issueId = await draggedIssueId(items);
      if (onDrop === undefined || issueId === null) {
        return;
      }
      onDrop({ issueId, laneId: lane.id, targetIssueId: null, placement: "after" });
    },
    renderDropIndicator: (target) => (
      <DropIndicator
        target={target}
        className="my-1 h-[46px] border border-(--color-accent) border-dashed bg-(--color-accent-100)"
      />
    ),
  });

  return (
    <div
      data-region="lane"
      className="flex w-[268px] shrink-0 flex-col border-(--color-divider) border-r bg-(--color-chrome-tint)">
      <div className="flex h-(--size-row) flex-none items-center gap-1.5 border-(--color-divider) border-b px-2 font-medium text-[10.5px] text-(--color-text-muted) uppercase tracking-[0.1em]">
        {statusKind ? <StatusGlyph kind={statusKind} /> : null}
        <span className="truncate text-(--color-text)">{lane.name}</span>
        <span className="ml-auto font-mono normal-case tracking-normal">{lane.cards.length}</span>
      </div>
      <GridList
        key={canWrite ? "draggable" : "read-only"}
        aria-label={lane.name}
        items={lane.cards}
        dragAndDropHooks={canWrite ? dragAndDropHooks : undefined}
        renderEmptyState={() => <p className="px-2 py-3 text-(--color-text-muted) text-label">No cards</p>}
        className="grid content-start gap-1.5 p-1.5 data-[drop-target]:outline-2 data-[drop-target]:outline-(--color-accent)">
        {(card) => (
          <GridListItem
            id={card.id}
            textValue={`${card.key} ${card.title}`}
            className="group flex items-start gap-1 data-[focus-visible]:outline-2 data-[focus-visible]:outline-(--color-accent)">
            {canWrite ? (
              <Button
                slot="drag"
                aria-label={`Reorder ${card.key}`}
                className="mt-2.5 cursor-grab px-0.5 text-(--color-text-muted) leading-none data-[focus-visible]:outline-2 data-[focus-visible]:outline-(--color-accent)">
                ⠿
              </Button>
            ) : null}
            <div className="min-w-0 flex-1">
              <IssueCard
                card={card}
                isSelected={selectedIssueId === card.id}
                onSelect={onSelect}
              />
            </div>
          </GridListItem>
        )}
      </GridList>
      {composer && (
        <div className="px-1.5 pb-1.5">
          <CardComposer {...composer} />
        </div>
      )}
    </div>
  );
}