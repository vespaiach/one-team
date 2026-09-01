export type IconProps = {
  size: number;
  className?: string;
};

function IconBase({ size, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.25}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}>
      {children}
    </svg>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect
        width="20"
        height="16"
        x="2"
        y="4"
        rx="2"
      />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </IconBase>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <rect
        width="18"
        height="11"
        x="3"
        y="11"
        rx="2"
        ry="2"
      />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </IconBase>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle
        cx="12"
        cy="12"
        r="3"
      />
    </IconBase>
  );
}

export function EyeOffIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </IconBase>
  );
}

export function XCircleIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle
        cx="12"
        cy="12"
        r="10"
      />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </IconBase>
  );
}

export function BanIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle
        cx="12"
        cy="12"
        r="10"
      />
      <path d="m4.9 4.9 14.2 14.2" />
    </IconBase>
  );
}

export function ArrowLeftIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </IconBase>
  );
}

export function MailCheckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M22 13V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      <path d="m16 19 2 2 4-4" />
    </IconBase>
  );
}

export function InfoIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <circle
        cx="12"
        cy="12"
        r="10"
      />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </IconBase>
  );
}

export function KeyRoundIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" />
      <circle
        cx="16.5"
        cy="7.5"
        r=".5"
        fill="currentColor"
      />
    </IconBase>
  );
}

export function ShieldCheckIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12 2 2 4-4" />
    </IconBase>
  );
}

export function RefreshCwIcon(props: IconProps) {
  return (
    <IconBase {...props}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </IconBase>
  );
}