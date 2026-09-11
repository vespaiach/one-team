export type IconProps = {
  size?: number;
  className?: string;
};

function IconBase({ size = 16, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}>
      {children}
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </IconBase>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect
        width="18"
        height="18"
        x="3"
        y="4"
        rx="2"
      />
      <path d="M3 9h18" />
      <path d="M8 2v4" />
      <path d="M16 2v4" />
    </IconBase>
  );
}

export function MembersIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle
        cx="9"
        cy="8"
        r="3.25"
      />
      <path d="M2.75 19a6.25 6.25 0 0 1 12.5 0" />
      <path d="M15.5 5.5a3.25 3.25 0 0 1 0 6.34" />
      <path d="M18.5 19a6 6 0 0 0-3-5.34" />
    </IconBase>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m6 9 6 6 6-6" />
    </IconBase>
  );
}

export function BoldIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 4h7a3.5 3.5 0 0 1 0 7H6z" />
      <path d="M6 11h8a3.5 3.5 0 0 1 0 7H6z" />
    </IconBase>
  );
}

export function ItalicIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M11 4h6" />
      <path d="M5 20h6" />
      <path d="M14 4 8 20" />
    </IconBase>
  );
}

export function InlineCodeIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m8 7-5 5 5 5" />
      <path d="m16 7 5 5-5 5" />
    </IconBase>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M7 17 17 7" />
      <path d="M9 7h8v8" />
    </IconBase>
  );
}

export function BulletListIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle
        cx="4.5"
        cy="6"
        r="1.25"
        fill="currentColor"
        stroke="none"
      />
      <circle
        cx="4.5"
        cy="12"
        r="1.25"
        fill="currentColor"
        stroke="none"
      />
      <circle
        cx="4.5"
        cy="18"
        r="1.25"
        fill="currentColor"
        stroke="none"
      />
      <path d="M9 6h11" />
      <path d="M9 12h11" />
      <path d="M9 18h11" />
    </IconBase>
  );
}

export function NumberedListIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M9 6h11" />
      <path d="M9 12h11" />
      <path d="M9 18h11" />
      <path d="M4 5v3" />
      <path d="M4 5h1" />
      <path d="M4 11h1.5a1 1 0 0 1 0 2H4" />
      <path d="M4 13h1.5a1 1 0 0 1 0 4H4" />
      <path d="M4 17.5h2" />
    </IconBase>
  );
}

export function HeadingIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M6 4v16" />
      <path d="M18 4v16" />
      <path d="M6 12h12" />
    </IconBase>
  );
}