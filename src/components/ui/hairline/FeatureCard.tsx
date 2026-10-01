import * as React from 'react';
import { Link } from 'react-aria-components';
import { cx, focusRing } from './lib/cx';

export interface FeatureCardProps { eyebrow?: React.ReactNode; title: React.ReactNode; children?: React.ReactNode; media?: React.ReactNode; href?: string; className?: string; }

const CARD = 'box-border block bg-surface-1 text-ink border border-hairline rounded-lg p-6 shadow-edge font-text text-body';
const LINKED = cx('no-underline cursor-pointer transition-[background-color,border-color] duration-160 data-hovered:bg-surface-2 data-hovered:border-hairline-strong data-hovered:text-ink', focusRing);

export function FeatureCard({ eyebrow, title, children, media, href, className }: FeatureCardProps) {
  const body = (
    <>
      {media && <div className="-mx-6 -mt-6 mb-6 border-b border-hairline rounded-t-lg overflow-hidden bg-canvas">{media}</div>}
      {eyebrow && <p className="mb-3 text-eyebrow text-honey">{eyebrow}</p>}
      <h3 className="font-display text-card-title text-ink">{title}</h3>
      {children && <div className="mt-2 text-body-sm text-ink-subtle text-pretty">{children}</div>}
    </>
  );
  return href
    ? <Link href={href} className={cx(CARD, LINKED, className)}>{body}</Link>
    : <div className={cx(CARD, className)}>{body}</div>;
}
