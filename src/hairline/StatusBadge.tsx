import * as React from 'react';
import { cx } from './lib/cx';

export type StatusTone = 'neutral' | 'success' | 'accent' | 'warm' | 'soft' | 'cool' | 'rust';
const DOTS: Record<StatusTone, string> = { neutral: 'bg-ink-subtle', success: 'bg-success', accent: 'bg-primary', warm: 'bg-honey', soft: 'bg-sand', cool: 'bg-mist', rust: 'bg-rust' };

export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: StatusTone;
  /** Defaults to true for any tone except neutral */
  dot?: boolean;
}

/** Static pill label — no React Aria needed. */
export function StatusBadge({ tone = 'neutral', dot, className, children, ...rest }: StatusBadgeProps) {
  const showDot = dot ?? tone !== 'neutral';
  return (
    <span {...rest} className={cx('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-pill border font-text text-caption whitespace-nowrap',
      tone === 'accent' ? 'bg-badge-accent border-badge-accent-edge text-honey' : 'bg-surface-2 border-hairline text-ink-muted', className)}>
      {showDot && <span className={cx('size-1.5 rounded-full flex-none', DOTS[tone])} aria-hidden="true" />}
      {children}
    </span>
  );
}
