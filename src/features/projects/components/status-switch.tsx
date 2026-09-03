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
        className="flex items-center gap-2">
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