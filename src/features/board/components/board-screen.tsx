"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { createBoardCard, type MoveIssueState, moveIssue } from "@/features/issues/actions";
import { ProjectHeader } from "@/features/projects/components/project-header";
import { showToast } from "@/features/shell/components/toast-region";
import { type Drop, type Grouping, lanesFor, replayPendingMoves, UNASSIGNED_LANE_ID } from "../lane-model";
import type { BoardView } from "../server/board-queries";
import { BoardLane } from "./board-lane";
import { GroupingControl } from "./grouping-control";

type MoveRefusal = Exclude<MoveIssueState, { ok: true }>;

const REFRESH_INTERVAL_MS = 30_000;

const REFUSAL_MESSAGES: Record<Exclude<MoveRefusal["error"], "forbidden">, string> = {
  not_found: "That card wasn't moved — the card or its lane is gone. The board has been refreshed.",
  invalid_target: "That card wasn't moved — that drop isn't a legal one for that lane.",
  no_index_available:
    "That card wasn't moved — it couldn't be placed between those two cards, and nothing was moved.",
};

const MOVE_FAILED_MESSAGE =
  "That card wasn't moved — the connection was lost. Nothing is queued; try the drag again.";

function refusalMessage(refusal: MoveRefusal): string {
  return refusal.error === "forbidden" ? refusal.reason : REFUSAL_MESSAGES[refusal.error];
}

function ontoLivingLanes(
  pendingMoves: ReadonlyMap<string, Drop>,
  laneIds: ReadonlySet<string>,
): Map<string, Drop> {
  return new Map([...pendingMoves].filter(([, drop]) => laneIds.has(drop.laneId)));
}

function stillInFlight(
  pendingMoves: ReadonlyMap<string, Drop>,
  settledDrops: ReadonlySet<Drop>,
): Map<string, Drop> {
  return new Map([...pendingMoves].filter(([, drop]) => !settledDrops.has(drop)));
}

export function BoardScreen({
  board,
  commentCount,
  newIssue,
}: {
  board: BoardView;
  commentCount?: number;
  newIssue?: ReactNode;
}) {
  const router = useRouter();
  const [grouping, setGrouping] = useState<Grouping>("column");
  const [pendingMoves, setPendingMoves] = useState<ReadonlyMap<string, Drop>>(new Map());
  const [settledDrops, setSettledDrops] = useState<ReadonlySet<Drop>>(new Set());
  const [serverCards, setServerCards] = useState(board.cards);
  const latestDrops = useRef(new Map<string, Drop>());

  if (serverCards !== board.cards) {
    setServerCards(board.cards);
    setPendingMoves(stillInFlight(pendingMoves, settledDrops));
    setSettledDrops(new Set());
  }

  const livingLaneIds = new Set(lanesFor(grouping, board).map((lane) => lane.id ?? UNASSIGNED_LANE_ID));
  const cards = replayPendingMoves(board.cards, ontoLivingLanes(pendingMoves, livingLaneIds), grouping);
  const lanes = lanesFor(grouping, { ...board, cards });

  useEffect(() => {
    function refreshNow() {
      router.refresh();
    }
    function refreshWhileVisible() {
      if (document.visibilityState === "visible") {
        refreshNow();
      }
    }
    const ticking = setInterval(refreshWhileVisible, REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refreshNow);
    return () => {
      clearInterval(ticking);
      window.removeEventListener("focus", refreshNow);
    };
  }, [router]);

  function rollBack(issueId: string) {
    setPendingMoves((current) => {
      const remaining = new Map(current);
      remaining.delete(issueId);
      return remaining;
    });
  }

  function refuse(drop: Drop, message: string) {
    if (latestDrops.current.get(drop.issueId) !== drop) {
      return;
    }
    rollBack(drop.issueId);
    showToast({ kind: "error", message });
  }

  function startMove(drop: Drop) {
    latestDrops.current.set(drop.issueId, drop);
    setPendingMoves((current) => new Map(current).set(drop.issueId, drop));

    moveIssue({
      issueId: drop.issueId,
      grouping,
      laneId: drop.laneId === UNASSIGNED_LANE_ID ? null : drop.laneId,
      targetIssueId: drop.targetIssueId,
      placement: drop.placement,
    }).then(
      (result) => {
        if (result.ok) {
          setSettledDrops((current) => new Set(current).add(drop));
          return;
        }
        refuse(drop, refusalMessage(result));
        if (result.error === "not_found") {
          router.refresh();
        }
      },
      () => {
        refuse(drop, MOVE_FAILED_MESSAGE);
      },
    );
  }

  return (
    <>
      <ProjectHeader
        projectKey={board.project.key}
        name={board.project.name}
        current="board"
        commentCount={commentCount}
        newIssue={newIssue}
        control={
          <GroupingControl
            grouping={grouping}
            onChange={setGrouping}
          />
        }
      />
      <div
        data-region="board"
        className="flex gap-4 overflow-x-auto p-4">
        {lanes.map((lane) => (
          <BoardLane
            key={lane.id ?? UNASSIGNED_LANE_ID}
            lane={{ ...lane, id: lane.id ?? UNASSIGNED_LANE_ID }}
            projectKey={board.project.key}
            canWrite={board.canWrite}
            onDrop={startMove}
            composer={{
              projectId: board.project.id,
              projectKey: board.project.key,
              grouping,
              laneId: lane.id,
              laneName: lane.name,
              firstColumnId: board.columns[0]?.id ?? "",
              canWrite: board.canWrite,
              writeReason: board.writeReason,
              laneAcceptsWrite: lane.canAcceptDrop,
              onCreate: createBoardCard,
            }}
          />
        ))}
      </div>
    </>
  );
}