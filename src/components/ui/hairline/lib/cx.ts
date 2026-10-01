import { composeRenderProps } from 'react-aria-components';

export const cx = (...a: Array<string | false | null | undefined>) => a.filter(Boolean).join(' ');

/** Append a consumer className (string or RAC render-prop function) after the component's own classes. */
export function tw<T>(className: string | ((v: T & { defaultClassName: string | undefined }) => string) | undefined, base: string) {
  return composeRenderProps(className as any, (c: string | undefined) => cx(base, c)) as any;
}

/** 2px terracotta ring at 50%, offset 2px — keyboard focus only (RAC data-focus-visible). */
export const focusRing = 'outline-none data-focus-visible:outline-solid data-focus-visible:outline-2data-focus-visible:outline-offset-2 data-focus-visible:outline-focus-ring';
