import { notFound } from "next/navigation";
import { Suspense } from "react";
import { countProjectComments } from "@/features/activity/server/feed-queries";
import type { Actor } from "@/features/auth/server/actor";
import { requireActor } from "@/features/auth/server/actor";
import { BoardScreen } from "@/features/board/components/board-screen";
import { BoardSkeleton } from "@/features/board/components/board-skeleton";
import { loadBoard } from "@/features/board/server/board-queries";
import { NewIssueModal } from "@/features/issues/components/new-issue-modal";
import { listAssigneePool, listProjectColumns } from "@/features/issues/server/issue-queries";
import { listLabelOptionsForIssue } from "@/features/labels/server/queries";

async function BoardData({
  projectKey,
  actor,
  openNewIssue,
}: {
  projectKey: string;
  actor: Actor;
  openNewIssue: boolean;
}) {
  const board = await loadBoard(projectKey, actor);
  if (!board) {
    notFound();
  }

  const [commentCount, columns, assigneePool, labelOptions] = await Promise.all([
    countProjectComments(board.project.id),
    listProjectColumns(board.project.id),
    listAssigneePool(board.project.id),
    listLabelOptionsForIssue(),
  ]);

  return (
    <BoardScreen
      board={board}
      commentCount={commentCount}
      newIssue={
        <NewIssueModal
          projectId={board.project.id}
          projectKey={board.project.key}
          columns={columns}
          assigneePool={assigneePool}
          labelOptions={labelOptions}
          canManageLabels={board.isAdmin}
          canWrite={board.canWrite}
          writeReason={board.writeReason}
          defaultOpen={openNewIssue}
        />
      }
    />
  );
}

export default async function ProjectBoardPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectKey: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await requireActor();
  const { projectKey } = await params;
  const query = (await searchParams) ?? {};

  return (
    <Suspense fallback={<BoardSkeleton />}>
      <BoardData
        projectKey={projectKey}
        actor={actor}
        openNewIssue={query.newIssue === "1"}
      />
    </Suspense>
  );
}