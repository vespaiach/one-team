import { CommandPaletteTrigger } from "@/features/shell/components/command-palette-trigger";
import { greetingForHour } from "../greeting";

const DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function HomeHeader({ firstName, now }: { firstName: string; now: Date }) {
  return (
    <header className="flex shrink-0 items-center gap-2 px-3 py-2.5">
      <div>
        <h1 className="text-h5">
          {greetingForHour(now.getHours())}, {firstName}
        </h1>
        <div className="mt-[3px] font-mono text-[11px] text-(--color-text-muted)">
          {DATE_FORMAT.format(now)}
        </div>
      </div>
      <div className="ms-auto flex items-center gap-1.5">
        <CommandPaletteTrigger />
      </div>
    </header>
  );
}