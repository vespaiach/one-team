import type { IconProps } from "./icons";

export function Banner({
  icon: Icon,
  children,
}: {
  icon: (props: IconProps) => React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex gap-[10px] border-l-[3px] border-[var(--color-accent)] bg-[var(--color-accent-100)] px-3 py-[11px] text-[13px] leading-[1.45] break-words text-[var(--color-text)]">
      <span className="flex-none text-[var(--color-accent)]">
        <Icon size={20} />
      </span>
      <span>{children}</span>
    </div>
  );
}