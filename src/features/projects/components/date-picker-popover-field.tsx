"use client";

import { type CalendarDate, parseDate } from "@internationalized/date";
import { Button } from "react-aria-components/Button";
import {
  DateInput,
  DatePicker,
  DateSegment,
  FieldError,
  Group,
  Label,
} from "react-aria-components/DatePicker";
import { Dialog, DialogTrigger } from "react-aria-components/Dialog";
import { Popover } from "react-aria-components/Popover";
import { CalendarIcon, ChevronDownIcon } from "./icons";

function toCalendarDate(value: string | null): CalendarDate | null {
  return value ? parseDate(value) : null;
}

function formatCalendarDate(date: CalendarDate): string {
  return new Date(date.year, date.month - 1, date.day).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function DatePickerPopoverField({
  label,
  value,
  onChange,
  isInvalid = false,
  errorMessage,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  isInvalid?: boolean;
  errorMessage?: string;
}) {
  const date = toCalendarDate(value);

  return (
    <DialogTrigger>
      <Button className="flex h-7 items-center gap-1.5 border border-(--color-divider) px-2.5 text-control text-(--color-text-muted) data-[hovered]:border-(--color-accent) data-[hovered]:text-(--color-text) data-[focus-visible]:outline-2 data-[focus-visible]:outline-(--color-accent)">
        <CalendarIcon size={14} />
        {date ? formatCalendarDate(date) : label}
        <ChevronDownIcon size={14} />
      </Button>
      <Popover className="border border-(--color-divider) bg-(--color-bg) p-3 shadow-md">
        <Dialog className="flex flex-col gap-1 outline-none">
          <DatePicker
            value={date}
            onChange={(next) => onChange(next ? next.toString() : null)}
            isInvalid={isInvalid}
            className="flex flex-col gap-1">
            <Label>{label}</Label>
            <Group>
              <DateInput>{(segment) => <DateSegment segment={segment} />}</DateInput>
            </Group>
            {isInvalid && errorMessage ? <FieldError>{errorMessage}</FieldError> : null}
          </DatePicker>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}