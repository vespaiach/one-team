import * as React from 'react';
import { cx } from './lib/cx';

export interface ProductScreenshotCardProps { src?: string; alt?: string; title?: React.ReactNode; caption?: React.ReactNode; aspectRatio?: string; children?: React.ReactNode; className?: string; }

/** 16px-radius surface-1 frame around a product UI screenshot. Never crop the screenshot. */
export function ProductScreenshotCard({ src, alt = '', title, caption, aspectRatio, children, className }: ProductScreenshotCardProps) {
  return (
    <figure className={cx('box-border bg-surface-1 text-ink border border-hairline rounded-xl p-6 shadow-edge font-text text-body', className)}>
      <div className="rounded-md border border-hairline overflow-hidden bg-canvas [&>img]:block [&>img]:w-full [&>img]:h-auto" style={aspectRatio ? { aspectRatio } : undefined}>
        {src ? <img src={src} alt={alt} /> : children}
      </div>
      {(title || caption) && (
        <figcaption className="flex justify-between gap-4 mt-4 text-body-sm text-ink-subtle">
          {title && <strong className="text-ink font-medium">{title}</strong>}
          {caption && <span>{caption}</span>}
        </figcaption>
      )}
    </figure>
  );
}
