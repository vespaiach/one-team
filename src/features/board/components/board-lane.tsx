import type { DropItem } from "react-aria-components";
import { Button } from "react-aria-components/Button";
import { GridList, GridListItem } from "react-aria-components/GridList";
import { DropIndicator, useDragAndDrop } from "react-aria-components/useDragAndDrop";
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
  projectKey,
  onDrop,
  composer,
  canWrite = true,
}: {
  lane: Lane<BoardCard> & { canAcceptDrop?: boolean };
  projectKey: string;
  onDrop?: (drop: Drop) => void;
  composer?: CardComposerProps;
  canWrite?: boolean;
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
        className="h-1 bg-(--color-accent)"
      />
    ),
  });

  return (
    <div
      data-region="lane"
      className="flex w-[288px] shrink-0 flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-control text-(--color-text)">{lane.name}</h2>
        <span className="text-label font-mono text-(--color-text-muted)">{lane.cards.length}</span>
      </div>
      <GridList
        key={canWrite ? "draggable" : "read-only"}
        aria-label={lane.name}
        items={lane.cards}
        dragAndDropHooks={canWrite ? dragAndDropHooks : undefined}
        renderEmptyState={() => <p className="text-label text-(--color-text-muted)">No cards</p>}
        className="flex flex-col gap-3 data-[drop-target]:outline-2 data-[drop-target]:outline-(--color-accent)">
        {(card) => (
          <GridListItem
            id={card.id}
            textValue={`${card.key} ${card.title}`}
            className="data-[focus-visible]:outline-2 data-[focus-visible]:outline-(--color-accent)">
            {canWrite ? (
              <Button
                slot="drag"
                className="px-1 text-left text-(--color-text-muted) data-[focus-visible]:outline-2 data-[focus-visible]:outline-(--color-accent)">
                ⠿
              </Button>
            ) : null}
            <IssueCard
              card={card}
              projectKey={projectKey}
            />
          </GridListItem>
        )}
      </GridList>
      {composer && <CardComposer {...composer} />}
    </div>
  );
}