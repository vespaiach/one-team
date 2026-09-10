import { splitOverflow } from "@/lib/overflow";
import { AVATAR_SIZE_CLASSES, Avatar } from "./avatar";

export type AvatarStackPerson = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

export function AvatarStack({ people, limit }: { people: readonly AvatarStackPerson[]; limit: number }) {
  const { shown, overflowCount } = splitOverflow(people, limit);

  return (
    <span className="flex items-center -space-x-1.5">
      {shown.map((person) => (
        <Avatar
          key={person.id}
          name={person.name}
          avatarUrl={person.avatarUrl}
          size="sm"
          decorative
        />
      ))}
      {overflowCount > 0 ? (
        <span
          className={`flex flex-none items-center justify-center rounded-full bg-(--color-chrome-tint-strong) font-mono text-(--color-text-muted) ${AVATAR_SIZE_CLASSES.sm}`}>
          +{overflowCount}
        </span>
      ) : null}
    </span>
  );
}