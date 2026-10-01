import * as React from 'react';
import { cx } from './lib/cx';

export interface CtaBannerProps { title: React.ReactNode; children?: React.ReactNode; actions?: React.ReactNode; align?: 'start' | 'center'; className?: string; }

export function CtaBanner({ title, children, actions, align = 'start', className }: CtaBannerProps) {
  return (
    <section className={cx('box-border flex flex-col gap-6 p-12 bg-cta text-ink border border-cta-edge rounded-lg shadow-edge font-text text-body', align === 'center' ? 'items-center text-center' : 'items-start', className)}>
      <h2 className="font-display text-headline text-ink text-balance">{title}</h2>
      {children && <p className="-mt-3 max-w-[520px] text-body text-sand">{children}</p>}
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </section>
  );
}
