"use client";

import type { ReactNode } from "react";
import { Tab, TabList, Tabs } from "react-aria-components/Tabs";
import { ScreenHeader } from "@/features/shell/components/screen-header";

export function ProjectHeader({
  projectKey,
  name,
  current,
  newIssue,
  commentCount,
}: {
  projectKey: string;
  name: string;
  current: "board" | "details";
  newIssue?: ReactNode;
  commentCount?: number;
}) {
  return (
    <ScreenHeader
      name={name}
      newIssue={newIssue}
      context={
        <div className="flex items-center gap-3">
          <Tabs selectedKey={current}>
            <TabList aria-label="Project sections">
              <Tab
                id="board"
                href={`/projects/${projectKey}`}
                className="mr-3 text-control text-(--color-text-muted) data-[hovered]:text-(--color-text) data-[selected]:text-(--color-text) data-[focus-visible]:outline-2 data-[focus-visible]:outline-(--color-accent)">
                Board
              </Tab>
              <Tab
                id="details"
                href={`/projects/${projectKey}/details`}
                className="text-control text-(--color-text-muted) data-[hovered]:text-(--color-text) data-[selected]:text-(--color-text) data-[focus-visible]:outline-2 data-[focus-visible]:outline-(--color-accent)">
                Details
              </Tab>
            </TabList>
          </Tabs>
          {commentCount !== undefined ? (
            <span className="text-label text-(--color-text-muted)">
              {commentCount} {commentCount === 1 ? "comment" : "comments"}
            </span>
          ) : null}
        </div>
      }
    />
  );
}