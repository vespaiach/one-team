import * as React from 'react';
import { cx } from './lib/cx';

export interface TestimonialCardProps { quote: React.ReactNode; name: string; role?: React.ReactNode; avatarSrc?: string; className?: string; }

export function TestimonialCard({ quote, name, role, avatarSrc, className }: TestimonialCardProps) {
  const initials = name.split(' ').map(s => s[0]).slice(0, 2).join('');
  return (
    <figure className={cx('box-border flex flex-col gap-6 bg-surface-1 text-ink border border-hairline rounded-lg p-8 shadow-edge font-text text-body', className)}>
      <blockquote className="text-body-lg text-ink text-pretty">{quote}</blockquote>
      <figcaption className="flex items-center gap-3">
        <span className="flex-none size-9 box-border rounded-full bg-rust border border-avatar-edge text-sand flex items-center justify-center text-[13px] font-medium leading-none overflow-hidden">
          {avatarSrc ? <img className="size-full object-cover" src={avatarSrc} alt="" /> : initials}
        </span>
        <span>
          <span className="block text-body-sm leading-[1.3] font-medium text-ink">{name}</span>
          {role && <span className="block text-caption text-ink-subtle">{role}</span>}
        </span>
      </figcaption>
    </figure>
  );
}
