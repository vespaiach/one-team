"use client";

import { useEffect, useState } from "react";
import { Button } from "react-aria-components/Button";
import { Pill } from "@/components/ui/pill";
import { StatusGlyph } from "@/components/ui/status-glyph";
import { Feed } from "@/features/activity/components/feed";
import { addIssueLabel, removeIssueLabel } from "@/features/labels/actions";
import { deleteIssue, loadIssueForDrawer, updateIssue } from "../actions";
import type { IssueDetailData } from "../server/issue-queries";
import { CopyableKey } from "./copyable-key";
import { DeleteIssueControl } from "./delete-issue-control";
import { EditableText } from "./editable-text";
import { IssueRail } from "./issue-rail";
import { IssueDrawerSkeleton } from "./issue-skeletons";

export function IssueDrawer({
  projectKey,
  issueNumber,
  onClose,
}: {
  projectKey: string;
  issueNumber: number | null;
  onClose: () => void;
}) {
  const [data, setData] = useState<IssueDetailData | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "not-found">("idle");

  useEffect(() => {
    if (issueNumber === null) {
      return;
    }
    let cancelled = false;
    setStatus("loading");
    loadIssueForDrawer({ projectKey, issueNumber }).then((result) => {
      if (cancelled) {
        return;
      }
      if (result.status === "ok") {
        setData(result.data);
        setStatus("ok");
      } else {
        setStatus("not-found");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [projectKey, issueNumber]);

  if (issueNumber === null) {
    return null;
  }

  return (
    <aside
      aria-label="Issue details"
      className="flex w-[400px] shrink-0 flex-col border-(--color-divider) border-l bg-(--color-bg)">
      <div className="flex h-[38px] flex-none items-center gap-2 border-(--color-divider) border-b px-3">
        {data ? (
          <>
            <Pill variant="id">{data.issue.key}</Pill>
            <Pill variant="status">
              <StatusGlyph kind={data.issue.column.kind} />
              {data.issue.column.name}
            </Pill>
          </>
        ) : null}
        <Button
          onPress={onClose}
          aria-label="Close"
          className="ml-auto font-mono text-(--color-text-muted) data-[hovered]:text-(--color-text) data-[focus-visible]:outline-2 data-[focus-visible]:outline-(--color-accent)">
          ✕
        </Button>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {status === "loading" || status === "idle" ? <IssueDrawerSkeleton /> : null}
        {status === "not-found" ? (
          <p className="text-(--color-text-muted) text-control">
            That issue couldn't be found. It may have been deleted.
          </p>
        ) : null}
        {status === "ok" && data ? (
          <div className="flex flex-col gap-4">
            <CopyableKey issueKey={data.issue.key} />
            <h2 className="text-h5">
              <EditableText
                label="Title"
                field="title"
                issueId={data.issue.id}
                value={data.issue.title}
                maxLength={200}
                canWrite={data.canWrite}
                writeReason={data.writeReason}
                updateIssueAction={updateIssue}
              />
            </h2>
            <div className="flex flex-wrap items-center gap-1.5">
              <Pill variant="project">{data.issue.project.key}</Pill>
              {data.labelOptions
                .filter((option) => option.applied)
                .map((option) => (
                  <Pill
                    key={option.id}
                    variant="label">
                    {option.name}
                  </Pill>
                ))}
              {data.issue.dueDate !== null ? (
                <span className="font-mono text-(--color-text-muted) text-caption">{data.issue.dueDate}</span>
              ) : null}
            </div>
            <EditableText
              label="Description"
              field="description"
              issueId={data.issue.id}
              value={data.issue.description ?? ""}
              multiline
              maxLength={10000}
              renderMarkdown
              canWrite={data.canWrite}
              writeReason={data.writeReason}
              updateIssueAction={updateIssue}
            />
            <div className="rule" />
            <IssueRail
              issueId={data.issue.id}
              column={data.issue.column}
              priority={data.issue.priority}
              assignee={data.issue.assignee}
              dueDate={data.issue.dueDate}
              columns={data.columns}
              assigneePool={data.assigneePool}
              canWrite={data.canWrite}
              writeReason={data.writeReason}
              updateIssueAction={updateIssue}
              labelOptions={data.labelOptions}
              canManageLabels={data.canManageLabels}
              addIssueLabelAction={addIssueLabel}
              removeIssueLabelAction={removeIssueLabel}
            />
            <DeleteIssueControl
              issueId={data.issue.id}
              issueKey={data.issue.key}
              issueTitle={data.issue.title}
              projectKey={projectKey}
              canDelete={data.canDelete}
              deleteReason={data.deleteReason}
              deleteIssueAction={deleteIssue}
            />
            <div className="rule" />
            <Feed
              target={{ issueId: data.issue.id }}
              initialPage={data.feedInitialPage}
              canPost={data.canComment}
              postReason={data.commentPostReason}
              viewer={data.viewer}
              feedFilter={data.feedFilter}
            />
          </div>
        ) : null}
      </div>
    </aside>
  );
}