"use client";

import { useOptimistic, useTransition } from "react";
import { Switch } from "react-aria-components/Switch";
import { showToast } from "@/features/shell/components/toast-region";

export type StatusSwitchSaveResult = { status: "saved" } | { status: "forbidden" };

const DISABLED_REASON_ID = "status-switch-disabled-reason";

export function StatusSwitch({
  status,
  isDisabled = false,
  disabledReason,
  onSave,
}: {
  status: "active" | "archived";
  isDisabled?: boolean;
  disabledReason?: string;
  onSave: (nextStatus: "active" | "archived") => Promise<StatusSwitchSaveResult>;
}) {
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(status);
  const [, startTransition] = useTransition();
  const isArchived = optimisticStatus === "archived";
  const reasonId = isDisabled && disabledReason ? DISABLED_REASON_ID : undefined;

  function handleChange(isSelected: boolean) {
    const nextStatus = isSelected ? "archived" : "active";
    startTransition(async () => {
      setOptimisticStatus(nextStatus);
      const result = await onSave(nextStatus);
      if (result.status !== "saved") {
        showToast({ kind: "error", message: "Couldn't change the project's status. Try again." });
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Switch
        isSelected={isArchived}
        onChange={handleChange}
        isDisabled={isDisabled}
        aria-describedby={reasonId}
        className="group flex items-center gap-2 data-[disabled]:opacity-60">
        <span className="relative inline-flex h-5 w-9 flex-none items-center rounded-full bg-(--color-neutral-300) transition-colors group-data-[hovered]:bg-(--color-neutral-400) group-data-[selected]:bg-(--color-accent) group-data-[focus-visible]:outline-2 group-data-[focus-visible]:outline-offset-2 group-data-[focus-visible]:outline-(--color-accent)">
          <span className="inline-block h-4 w-4 translate-x-0.5 rounded-full bg-(--color-bg) transition-transform group-data-[selected]:translate-x-[18px]" />
        </span>
        {isArchived ? "Archived" : "Active"}
      </Switch>
      {isDisabled && disabledReason ? (
        <p
          id={reasonId}
          className="text-label text-(--color-text-muted)">
          {disabledReason}
        </p>
      ) : null}
    </div>
  );
}