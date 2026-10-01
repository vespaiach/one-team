import React from 'react';
const cx = (...a) => a.filter(Boolean).join(' ');

export function TextInput({ label, hint, id, multiline = false, className, inputClassName, ...rest }) {
  const autoId = React.useId ? React.useId() : undefined;
  const fid = id || autoId;
  const Tag = multiline ? 'textarea' : 'input';
  return (
    <div className={cx('ds-field', className)}>
      {label && <label className="ds-field__label" htmlFor={fid}>{label}</label>}
      <Tag id={fid} className={cx('ds-input', inputClassName)} {...rest} />
      {hint && <span className="ds-field__hint">{hint}</span>}
    </div>
  );
}
