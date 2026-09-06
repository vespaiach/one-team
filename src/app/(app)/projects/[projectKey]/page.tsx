import { notFound } from "next/navigation";
import { Suspense } from "react";
import { countProjectComments } from "@/features/activity/server/feed-queries";
import type { Actor } from "@/features/auth/server/actor";
import { requireActor } from "@/features/auth/server/actor";
import { BoardScreen } from "@/features/board/components/board-screen";
import { BoardSkeleton } from "@/features/board/components/board-skeleton";
import { loadBoard } from "@/features/board/server/board-queries";
import { NewIssueControl } from "@/features/issues/components/new-issue-control";
import { buildIssueWriteReason } from "@/features/issues/server/issue-queries";
import { ProjectHeader } from "@/features/projects/components/project-header";

async function BoardData({ projectKey, actor }: { projectKey: string; actor: Actor }) {
  const board = await loadBoard(projectKey, actor);
  if (!board) {
    notFound();
  }

  const commentCount = await countProjectComments(board.project.id);

  return (
    <BoardScreen board={board}>
      <ProjectHeader
        projectKey={board.project.key}
        name={board.project.name}
        current="board"
        commentCount={commentCount}
        newIssue={
          <NewIssueControl
            projectKey={board.project.key}
            canWrite={board.canWrite}
            writeReason={board.canWrite ? "" : buildIssueWriteReason("create", board.project.name)}
          />
        }
      />
    </BoardScreen>
  );
}

export default async function ProjectBoardPage({ params }: { params: Promise<{ projectKey: string }> }) {
  const actor = await requireActor();
  const { projectKey } = await params;

  return (
    <Suspense fallback={<BoardSkeleton />}>
      <BoardData
        projectKey={projectKey}
        actor={actor}
      />
    </Suspense>
  );
}