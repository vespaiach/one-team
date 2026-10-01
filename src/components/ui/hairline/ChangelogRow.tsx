import * as React from 'react';
import { cx } from './lib/cx';

export interface ChangelogRowProps { date?: React.ReactNode; version?: React.ReactNode; title: React.ReactNode; tags?: React.ReactNode; children?: React.ReactNode; className?: string; }

export function ChangelogRow({ date, version, title, tags, children, className }: ChangelogRowProps) {
  return (
    <article className={cx('grid grid-cols-[160px_minmax(0,1fr)] gap-6 py-6 border-b border-hairline bg-canvas text-ink font-text text-body max-md:grid-cols-1 max-md:gap-3', className)}>
      <div className="flex flex-col gap-1.5 items-start">
        {date && <time className="text-body-sm text-ink-subtle">{date}</time>}
        {version && <span className="font-mono text-mono text-honey">{version}</span>}
        {tags}
      </div>
      <div>
        <h3 className="mb-2 font-display text-card-title">{title}</h3>
        <div className="text-ink-muted [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-[18px] [&_ul]:text-ink-subtle [&_ul]:text-body-sm">{children}</div>
      </div>
    </article>
  );
}
