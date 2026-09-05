import type { ActivityType } from "../server/write-activity";

const NONE_LABEL = "None";

function displayOrNone(value: string | null): string {
  return value ?? NONE_LABEL;
}

function buildSentence(
  actorName: string,
  type: Exclude<ActivityType, "comment">,
  field: string | null,
  fromValue: string | null,
  toValue: string | null,
): string {
  switch (type) {
    case "created":
      return `${actorName} created this`;
    case "field_changed":
      return `${actorName} changed ${field} from ${displayOrNone(fromValue)} to ${displayOrNone(toValue)}`;
    case "member_added":
      return `${actorName} added ${displayOrNone(toValue)}`;
    case "member_removed":
      return `${actorName} removed ${displayOrNone(fromValue)}`;
    case "archived":
      return `${actorName} archived this`;
    case "reopened":
      return `${actorName} reopened this`;
    case "column_added":
      return `${actorName} added column ${field}`;
    case "column_renamed":
      return `${actorName} renamed column ${displayOrNone(fromValue)} to ${displayOrNone(toValue)}`;
    case "column_reordered":
      return toValue === null
        ? `${actorName} moved column ${field} to first`
        : `${actorName} moved column ${field} after ${toValue}`;
    case "column_deleted":
      return `${actorName} deleted column ${field}`;
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
  const sentence = buildSentence(`${actor.firstName} ${actor.lastName}`, type, field, fromValue, toValue);

  return <p className="text-control text-(--color-text)">{sentence}</p>;
}