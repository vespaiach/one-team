import React from 'react';
const cx = (...a) => a.filter(Boolean).join(' ');

export function Button({ variant = 'primary', href, disabled = false, block = false, iconLeft, iconRight, type = 'button', className, children, ...rest }) {
  const cls = cx('ds-btn', 'ds-btn--' + variant, block && 'ds-btn--block', className);
  const inner = (
    <>
      {iconLeft && <span className="ds-btn__icon" aria-hidden="true">{iconLeft}</span>}
      {children}
      {iconRight && <span className="ds-btn__icon" aria-hidden="true">{iconRight}</span>}
    </>
  );
  if (href) return <a className={cls} href={disabled ? undefined : href} aria-disabled={disabled || undefined} {...rest}>{inner}</a>;
  return <button className={cls} type={type} disabled={disabled} {...rest}>{inner}</button>;
}
