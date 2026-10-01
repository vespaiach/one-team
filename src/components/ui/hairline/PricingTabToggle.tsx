import * as React from 'react';
import { ToggleButtonGroup, ToggleButton, type Key } from 'react-aria-components';
import { cx, focusRing } from './lib/cx';

export interface PricingTabOption { value: string; label: React.ReactNode; /** e.g. "–20%" */ note?: React.ReactNode; }

export interface PricingTabToggleProps {
  options: (string | PricingTabOption)[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  'aria-label'?: string;
  className?: string;
}

const TAB = cx(
  'group inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-pill bg-canvas text-ink-subtle font-text text-button cursor-pointer',
  'transition-[background-color,color] data-hovered:text-ink',
  'data-selected:bg-surface-2 data-selected:text-ink data-selected:inset-ring data-selected:inset-ring-hairline-tab',
  focusRing, 'data-focus-visible:outline-offset-1',
);

/** Pill segmented toggle. Selection is a surface lift (surface-2 + tinted inset ring), not a color fill. */
export function PricingTabToggle({ options, value, defaultValue, onChange, className, ...rest }: PricingTabToggleProps) {
  const items = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o));
  const toKeys = (v?: string) => (v === undefined ? undefined : new Set<Key>([v]));
  return (
    <ToggleButtonGroup
      {...rest}
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={toKeys(value)}
      defaultSelectedKeys={toKeys(defaultValue ?? (value === undefined ? items[0]?.value : undefined))}
      onSelectionChange={keys => { const k = [...keys][0]; if (k !== undefined) onChange?.(String(k)); }}
      className={cx('inline-flex gap-0.5 p-[3px] rounded-pill bg-canvas border border-hairline', className)}
    >
      {items.map(o => (
        <ToggleButton key={o.value} id={o.value} className={TAB}>
          {o.label}
          {o.note && <span className="font-normal text-caption text-ink-subtle group-data-selected:text-honey">{o.note}</span>}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}
