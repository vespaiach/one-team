"use client";

import { parseDate } from "@internationalized/date";
import { DatePickerPopoverField } from "./date-picker-popover-field";

export function DateRangeFields({
  startDate,
  targetDate,
  onStartDateChange,
  onTargetDateChange,
}: {
  startDate: string | null;
  targetDate: string | null;
  onStartDateChange: (value: string | null) => void;
  onTargetDateChange: (value: string | null) => void;
}) {
  const start = startDate ? parseDate(startDate) : null;
  const target = targetDate ? parseDate(targetDate) : null;
  const targetBeforeStart = start !== null && target !== null && target.compare(start) < 0;

  return (
    <div className="flex gap-2">
      <DatePickerPopoverField
        label="Start date"
        value={startDate}
        onChange={onStartDateChange}
      />
      <DatePickerPopoverField
        label="Target date"
        value={targetDate}
        onChange={onTargetDateChange}
        isInvalid={targetBeforeStart}
        errorMessage="Target date can't be before the start date."
      />
    </div>
  );
}