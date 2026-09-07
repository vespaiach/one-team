export function AuthShowcase() {
  return (
    <div
      aria-hidden="true"
      className="relative hidden flex-col justify-between gap-10 overflow-hidden bg-[var(--color-bg)] px-10 py-14 lg:flex">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(43,28,21,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(43,28,21,0.05) 1px, transparent 1px)",
          backgroundSize: "12px 12px",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(43,28,21,0.09) 1px, transparent 1px), linear-gradient(to bottom, rgba(43,28,21,0.09) 1px, transparent 1px)",
          backgroundSize: "96px 96px",
        }}
      />
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 600 960"
        preserveAspectRatio="xMidYMid slice"
        fill="none">
        <g
          stroke="var(--color-accent)"
          strokeWidth={1.5}
          opacity={0.55}>
          <path d="M0 96h132l36 36v120h96" />
          <path d="M0 300h84l48-48h108" />
          <path d="M264 132h84l36 36h216" />
          <path d="M600 252H444l-36 36v96" />
          <path d="M132 252v192l48 48h108" />
          <path d="M288 492h96l36-36h180" />
          <path d="M0 636h156l36 36v144" />
          <path d="M420 588v120l-36 36H240" />
          <path d="M600 780H456l-36 36" />
          <path d="M192 816h96l36 36h276" />
        </g>
        <g
          fill="var(--color-accent)"
          opacity={0.75}>
          <circle
            cx={132}
            cy={252}
            r={4}
          />
          <circle
            cx={264}
            cy={132}
            r={4}
          />
          <circle
            cx={408}
            cy={384}
            r={4}
          />
          <circle
            cx={132}
            cy={444}
            r={4}
          />
          <circle
            cx={420}
            cy={456}
            r={4}
          />
          <circle
            cx={192}
            cy={672}
            r={4}
          />
          <circle
            cx={240}
            cy={744}
            r={4}
          />
          <circle
            cx={420}
            cy={816}
            r={4}
          />
          <circle
            cx={288}
            cy={852}
            r={4}
          />
        </g>
        <g
          stroke="var(--color-text)"
          strokeWidth={1.5}
          opacity={0.5}>
          <rect
            x={396}
            y={156}
            width={144}
            height={144}
          />
          <path d="M396 192h-18M396 228h-18M396 264h-18M540 192h18M540 228h18M540 264h18M432 156v-18M468 156v-18M504 156v-18M432 300v18M468 300v18M504 300v18" />
          <rect
            x={408}
            y={636}
            width={132}
            height={96}
          />
          <path d="M408 672h-18M408 708h-18M540 672h18M540 708h18M444 636v-18M492 636v-18M444 732v18M492 732v18" />
        </g>
      </svg>

      <div className="relative flex items-start justify-between gap-4">
        <span className="bg-[var(--color-bg)] font-[family-name:var(--font-mono-ui)] text-[10.5px] tracking-[0.1em] text-[var(--color-text)] uppercase">
          localhost:3000
        </span>
        <span className="bg-[var(--color-bg)] font-[family-name:var(--font-mono-ui)] text-[10.5px] tracking-[0.1em] text-[color-mix(in_srgb,var(--color-text)_62%,transparent)] uppercase">
          v1
        </span>
      </div>

      <div className="relative grid justify-items-start gap-4">
        <span className="font-[family-name:var(--font-heading)] text-[clamp(56px,7.6vw,104px)] leading-[0.92] font-extrabold tracking-[-0.035em] text-[var(--color-text)]">
          One
          <br />
          Team
        </span>
        <p className="m-0 max-w-[22ch] font-[family-name:var(--font-heading)] text-[19px] leading-[1.35] text-[var(--color-text)] italic">
          One team, one workspace.
        </p>
      </div>

      <div className="relative grid justify-items-start gap-1.5">
        <span className="font-[family-name:var(--font-mono-ui)] text-[10.5px] tracking-[0.08em] text-[var(--color-text)] uppercase">
          One box · Postgres 18 · SMTP yours
        </span>
        <span className="font-[family-name:var(--font-mono-ui)] text-[10.5px] tracking-[0.08em] text-[color-mix(in_srgb,var(--color-text)_62%,transparent)] uppercase">
          Sessions in the database, not a token
        </span>
      </div>
    </div>
  );
}