"use client";

import { type CalendarDate, parseDate } from "@internationalized/date";
import {
  DateInput,
  DatePicker,
  DateSegment,
  FieldError,
  Group,
  Label,
} from "react-aria-components/DatePicker";

function toCalendarDate(value: string | null): CalendarDate | null {
  return value ? parseDate(value) : null;
}

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
  const start = toCalendarDate(startDate);
  const target = toCalendarDate(targetDate);
  const targetBeforeStart = start !== null && target !== null && target.compare(start) < 0;

  return (
    <div className="flex gap-[14px]">
      <DatePicker
        value={start}
        onChange={(value) => onStartDateChange(value ? value.toString() : null)}
        className="flex flex-col gap-[5px]">
        <Label>Start date</Label>
        <Group>
          <DateInput>{(segment) => <DateSegment segment={segment} />}</DateInput>
        </Group>
      </DatePicker>
      <DatePicker
        value={target}
        onChange={(value) => onTargetDateChange(value ? value.toString() : null)}
        isInvalid={targetBeforeStart}
        className="flex flex-col gap-[5px]">
        <Label>Target date</Label>
        <Group>
          <DateInput>{(segment) => <DateSegment segment={segment} />}</DateInput>
        </Group>
        {targetBeforeStart && <FieldError>Target date can&apos;t be before the start date.</FieldError>}
      </DatePicker>
    </div>
  );
}