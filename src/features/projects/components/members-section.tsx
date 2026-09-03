"use client";

import type { Key } from "react";
import { useOptimistic, useTransition } from "react";
import { Button } from "react-aria-components/Button";
import { ComboBox, Input, Label, Popover } from "react-aria-components/ComboBox";
import { ListBox, ListBoxItem } from "react-aria-components/ListBox";
import { showToast } from "@/features/shell/components/toast-region";
import type { RosterEntry } from "../server/queries";

export type MembershipPayload = { projectKey: string; userId: string };
export type MembershipActionResult = { status: "saved" } | { status: "forbidden" };

export type MembersSectionAdmin = {
  projectKey: string;
  candidates: RosterEntry[];
  addProjectMemberAction: (input: MembershipPayload) => Promise<MembershipActionResult>;
  removeProjectMemberAction: (input: MembershipPayload) => Promise<MembershipActionResult>;
};

const DEFAULT_DISABLED_REASON = "Only admins can change project membership.";
const DISABLED_REASON_ID = "members-section-disabled-reason";

export function MembersSection({
  roster,
  admin,
  disabledReason = DEFAULT_DISABLED_REASON,
}: {
  roster: RosterEntry[];
  admin?: MembersSectionAdmin;
  disabledReason?: string;
}) {
  const [optimisticRoster, setOptimisticRoster] = useOptimistic(roster);
  const [, startTransition] = useTransition();
  const isDisabled = admin === undefined;
  const reasonId = isDisabled ? DISABLED_REASON_ID : undefined;

  const selectedIds = new Set(optimisticRoster.map((member) => member.userId));
  const available = admin ? admin.candidates.filter((candidate) => !selectedIds.has(candidate.userId)) : [];

  function handleAdd(key: Key | null) {
    if (!admin || key === null) {
      return;
    }
    const chosen = admin.candidates.find((candidate) => candidate.userId === key);
    if (!chosen) {
      return;
    }
    const { projectKey, addProjectMemberAction } = admin;
    startTransition(async () => {
      setOptimisticRoster([...roster, chosen]);
      const result = await addProjectMemberAction({ projectKey, userId: chosen.userId });
      if (result.status !== "saved") {
        showToast({ kind: "error", message: `Couldn't add ${chosen.displayName}. Try again.` });
      }
    });
  }

  function handleRemove(entry: RosterEntry) {
    if (!admin) {
      return;
    }
    const { projectKey, removeProjectMemberAction } = admin;
    startTransition(async () => {
      setOptimisticRoster(roster.filter((member) => member.userId !== entry.userId));
      const result = await removeProjectMemberAction({ projectKey, userId: entry.userId });
      if (result.status !== "saved") {
        showToast({ kind: "error", message: `Couldn't remove ${entry.displayName}. Try again.` });
      }
    });
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-label text-(--color-text-muted)">Members</h2>
      <ul className="flex flex-col gap-1">
        {optimisticRoster.map((member) => (
          <li
            key={member.userId}
            className="flex items-center justify-between gap-2">
            <span>{member.displayName}</span>
            <Button
              onPress={() => handleRemove(member)}
              isDisabled={isDisabled}
              aria-label={`Remove ${member.displayName}`}
              aria-describedby={reasonId}>
              Remove
            </Button>
          </li>
        ))}
      </ul>

      <ComboBox
        items={available}
        selectedKey={null}
        onSelectionChange={handleAdd}
        isDisabled={isDisabled}
        menuTrigger="focus"
        className="flex flex-col gap-1">
        <Label>Add member</Label>
        <Input
          placeholder="Add a member"
          aria-describedby={reasonId}
        />
        <Popover>
          <ListBox>
            {(item: RosterEntry) => <ListBoxItem id={item.userId}>{item.displayName}</ListBoxItem>}
          </ListBox>
        </Popover>
      </ComboBox>

      {isDisabled ? (
        <p
          id={reasonId}
          className="text-label text-(--color-text-muted)">
          {disabledReason}
        </p>
      ) : null}
    </section>
  );
}