import * as React from 'react';
import { Button as AriaButton, Link as AriaLink, composeRenderProps, type ButtonProps as AriaButtonProps, type LinkProps as AriaLinkProps } from 'react-aria-components';
import { cx, tw, focusRing } from './lib/cx';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'inverse';

const BASE = cx(
  'items-center justify-center gap-1.5 box-border px-3.5 py-2 pointer-coarse:py-3 rounded-md border border-transparent',
  'font-text text-button whitespace-nowrap no-underline cursor-pointer select-none',
  'transition-[background-color,border-color,color]',
  focusRing,
  'data-disabled:opacity-40 data-disabled:cursor-not-allowed',
);

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-on-primary data-hovered:bg-primary-hover data-hovered:text-on-primary data-pressed:bg-primary-focus',
  secondary: 'bg-surface-1 text-ink border-hairline data-hovered:bg-surface-2 data-hovered:border-hairline-warm data-hovered:text-ink data-pressed:bg-surface-3',
  tertiary: 'bg-transparent text-ink data-hovered:bg-surface-1 data-hovered:text-ink data-pressed:bg-surface-2',
  inverse: 'bg-inverse-canvas text-inverse-ink data-hovered:bg-inverse-surface-1 data-hovered:text-inverse-ink data-pressed:bg-sand',
};

const ICON = 'inline-flex size-4 flex-none *:size-full';

interface Shared {
  /** primary = terracotta CTA (once per view) · secondary = charcoal + hairline · tertiary = text · inverse = light on dark */
  variant?: ButtonVariant;
  /** Full width */
  block?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

function withIcons<T>(children: any, iconLeft?: React.ReactNode, iconRight?: React.ReactNode) {
  return composeRenderProps(children, (c: React.ReactNode) => (
    <>
      {iconLeft && <span className={ICON} aria-hidden="true">{iconLeft}</span>}
      {c}
      {iconRight && <span className={ICON} aria-hidden="true">{iconRight}</span>}
    </>
  ));
}

export interface ButtonProps extends AriaButtonProps, Shared {}

export function Button({ variant = 'primary', block, iconLeft, iconRight, className, children, ...props }: ButtonProps) {
  return (
    <AriaButton {...props} className={tw(className, cx(block ? 'flex w-full' : 'inline-flex', BASE, VARIANTS[variant]))}>
      {withIcons(children, iconLeft, iconRight)}
    </AriaButton>
  );
}

export interface ButtonLinkProps extends AriaLinkProps, Shared {}

/** Same look as Button, renders an <a>. Use for navigation (href). */
export function ButtonLink({ variant = 'primary', block, iconLeft, iconRight, className, children, ...props }: ButtonLinkProps) {
  return (
    <AriaLink {...props} className={tw(className, cx(block ? 'flex w-full' : 'inline-flex', BASE, VARIANTS[variant]))}>
      {withIcons(children, iconLeft, iconRight)}
    </AriaLink>
  );
}
