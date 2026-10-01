import * as React from 'react';

/**
 * Compact 8px-radius button. `primary` is the only terracotta surface on a page — use it once per view.
 * @startingPoint section="Actions" subtitle="Primary, secondary, tertiary and inverse buttons" viewport="700x260"
 */
export interface ButtonProps extends React.HTMLAttributes<HTMLElement> {
  /** primary = terracotta CTA · secondary = charcoal + hairline · tertiary = plain text · inverse = white on dark */
  variant?: 'primary' | 'secondary' | 'tertiary' | 'inverse';
  /** Renders an <a> when set */
  href?: string;
  disabled?: boolean;
  /** Full-width */
  block?: boolean;
  /** 16px icon node before the label */
  iconLeft?: React.ReactNode;
  /** 16px icon node after the label */
  iconRight?: React.ReactNode;
  type?: 'button' | 'submit' | 'reset';
  className?: string;
  children?: React.ReactNode;
}
export declare function Button(props: ButtonProps): React.JSX.Element;
