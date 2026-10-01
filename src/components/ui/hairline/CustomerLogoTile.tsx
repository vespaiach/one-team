import * as React from 'react';
import { cx } from './lib/cx';

export interface CustomerLogoTileProps { src?: string; name: string; className?: string; }

/** Desaturated ~24px logo; falls back to the name as type. */
export function CustomerLogoTile({ src, name, className }: CustomerLogoTileProps) {
  return (
    <div className={cx('flex items-center justify-center box-border p-4 min-h-14 rounded-xs bg-canvas text-ink-subtle text-caption', className)}>
      {src
        ? <img className="h-6 w-auto opacity-70 grayscale brightness-160" src={src} alt={name} />
        : <span className="font-display font-semibold text-[17px] leading-none tracking-[-0.4px] text-ink-subtle">{name}</span>}
    </div>
  );
}
