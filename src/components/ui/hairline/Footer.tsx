import * as React from 'react';
import { Link } from 'react-aria-components';
import { cx, focusRing } from './lib/cx';

export interface FooterColumn { title: React.ReactNode; links: { label: React.ReactNode; href: string }[]; }
export interface FooterProps { brand?: React.ReactNode; tagline?: React.ReactNode; columns?: FooterColumn[]; legal?: React.ReactNode; className?: string; }

export function Footer({ brand = 'Hairline', tagline, columns = [], legal, className }: FooterProps) {
  return (
    <footer className={cx('bg-canvas text-ink-subtle border-t border-hairline font-text text-caption px-8 py-16', className)}>
      <div className="max-w-page mx-auto grid grid-cols-[minmax(160px,1.4fr)_repeat(auto-fit,minmax(120px,1fr))] gap-8">
        <div className="flex flex-col gap-3">
          <span className="font-display font-semibold text-[16px] leading-none tracking-[-0.3px] text-ink whitespace-nowrap">{brand}</span>
          {tagline && <span>{tagline}</span>}
        </div>
        {columns.map((c, i) => (
          <div key={i}>
            <h4 className="mb-4 text-caption font-medium text-sand">{c.title}</h4>
            <ul className="flex flex-col gap-2.5">
              {c.links.map((l, j) => (
                <li key={j}><Link href={l.href} className={cx('text-ink-subtle no-underline data-hovered:text-ink', focusRing)}>{l.label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      {legal && <div className="max-w-page mx-auto mt-12 pt-6 border-t border-hairline flex flex-wrap justify-between gap-4 text-ink-tertiary">{legal}</div>}
    </footer>
  );
}
