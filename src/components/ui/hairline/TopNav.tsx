import * as React from 'react';
import { Link } from 'react-aria-components';
import { cx, focusRing } from './lib/cx';

export interface TopNavLink { id: string; label: React.ReactNode; href: string; }

export interface TopNavProps {
  brand?: React.ReactNode;
  brandHref?: string;
  links?: TopNavLink[];
  /** id of the active link — sets aria-current="page" (styled honey) */
  current?: string;
  /** Right slot: <Button variant="tertiary">Sign in</Button><ButtonLink href="/start">Get started</ButtonLink> */
  actions?: React.ReactNode;
  sticky?: boolean;
  className?: string;
}

/** 56px bar, canvas @85% + 12px backdrop blur, hairline bottom border. Client routing: wrap the app in RAC <RouterProvider>. */
export function TopNav({ brand = 'Hairline', brandHref = '/', links = [], current, actions, sticky = true, className }: TopNavProps) {
  return (
    <header className={cx(sticky ? 'sticky top-0 z-50' : 'relative', 'h-nav bg-canvas/85 backdrop-blur-md border-b border-hairline text-ink font-text text-body-sm', className)}>
      <div className="box-border max-w-page h-full mx-auto px-6 flex items-center gap-6 max-md:justify-between">
        <Link href={brandHref} className={cx('font-display font-semibold text-[16px] leading-none tracking-[-0.3px] text-ink no-underline whitespace-nowrap inline-flex items-center gap-2 data-hovered:text-ink', focusRing)}>{brand}</Link>
        <nav className="flex flex-1 justify-center gap-0.5 max-md:hidden">
          {links.map(l => (
            <Link key={l.id} href={l.href} aria-current={current === l.id ? 'page' : undefined}
              className={cx('px-2.5 py-1.5 rounded-sm text-ink-subtle no-underline cursor-pointer transition-colors data-hovered:text-ink data-current:text-honey', focusRing)}>
              {l.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">{actions}</div>
      </div>
    </header>
  );
}
