import type { ActivityType } from "../server/write-activity";

const NONE_LABEL = "None";

function displayOrNone(value: string | null): string {
  return value ?? NONE_LABEL;
}

export function activityActionPhrase(
  type: Exclude<ActivityType, "comment">,
  field: string | null,
  fromValue: string | null,
  toValue: string | null,
): string {
  switch (type) {
    case "created":
      return "created this";
    case "field_changed":
      return `changed ${field} from ${displayOrNone(fromValue)} to ${displayOrNone(toValue)}`;
    case "member_added":
      return `added ${displayOrNone(toValue)}`;
    case "member_removed":
      return `removed ${displayOrNone(fromValue)}`;
    case "archived":
      return "archived this";
    case "reopened":
      return "reopened this";
    case "column_added":
      return `added column ${field}`;
    case "column_renamed":
      return `renamed column ${displayOrNone(fromValue)} to ${displayOrNone(toValue)}`;
    case "column_reordered":
      return toValue === null ? `moved column ${field} to first` : `moved column ${field} after ${toValue}`;
    case "column_deleted":
      return `deleted column ${field}`;
  }
}

export function ActivityRow({
  actor,
  type,
  field,
  fromValue,
  toValue,
}: {
  actor: { firstName: string; lastName: string };
  type: Exclude<ActivityType, "comment">;
  field: string | null;
  fromValue: string | null;
  toValue: string | null;
}) {
  const phrase = activityActionPhrase(type, field, fromValue, toValue);

  return (
    <p className="text-control text-(--color-text)">
      {actor.firstName} {actor.lastName} {phrase}
    </p>
  );
}