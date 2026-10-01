import * as React from 'react';
import { Button, ButtonLink, type ButtonVariant } from './Button';
import { cx } from './lib/cx';

export interface PricingCardProps {
  name: React.ReactNode; price: React.ReactNode; cadence?: React.ReactNode; description?: React.ReactNode;
  features?: React.ReactNode[]; ctaLabel?: React.ReactNode; ctaHref?: string; onCtaPress?: () => void;
  ctaVariant?: ButtonVariant;
  /** surface-2 + terracotta-tinted border; CTA defaults to primary */
  featured?: boolean;
  badge?: React.ReactNode; className?: string;
}

export function PricingCard({ name, price, cadence, description, features = [], ctaLabel = 'Get started', ctaHref, onCtaPress, ctaVariant, featured = false, badge, className }: PricingCardProps) {
  const variant = ctaVariant ?? (featured ? 'primary' : 'secondary');
  return (
    <div className={cx('box-border flex flex-col gap-6 text-ink border rounded-lg p-6 shadow-edge font-text text-body', featured ? 'bg-surface-2 border-hairline-featured' : 'bg-surface-1 border-hairline', className)}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-display text-headline">{name}</h3>
        {badge}
      </div>
      <div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-display-md leading-none">{price}</span>
          {cadence && <span className="text-body-sm text-ink-subtle">{cadence}</span>}
        </div>
        {description && <p className="mt-3 text-body-sm text-ink-subtle">{description}</p>}
      </div>
      {ctaHref
        ? <ButtonLink variant={variant} href={ctaHref} block>{ctaLabel}</ButtonLink>
        : <Button variant={variant} onPress={onCtaPress} block>{ctaLabel}</Button>}
      {features.length > 0 && (
        <ul className="flex flex-col gap-3 pt-6 border-t border-hairline text-body-sm text-ink-muted">
          {features.map((f, i) => (
            <li key={i} className="flex gap-2.5 items-start">
              <svg className="flex-none size-4 mt-0.5 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
              <span>{f}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
