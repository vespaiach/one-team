import * as React from 'react';
import { TextField, Label, Input, TextArea, Text, type TextFieldProps } from 'react-aria-components';
import { cx, tw } from './lib/cx';

const FIELD = cx(
  'box-border w-full px-3 py-2 rounded-md border border-hairline bg-surface-1 text-ink font-text text-body outline-none',
  'transition-[border-color,box-shadow] placeholder:text-ink-tertiary',
  'data-hovered:not-data-focused:border-hairline-strong data-focused:border-primary data-focused:shadow-focus',
  'data-disabled:opacity-50 data-disabled:cursor-not-allowed',
);

export interface TextInputProps extends TextFieldProps {
  label?: React.ReactNode;
  /** Helper text under the field (wired to aria-describedby) */
  hint?: React.ReactNode;
  placeholder?: string;
  /** Render a <textarea> */
  multiline?: boolean;
  rows?: number;
  inputClassName?: string;
}

export function TextInput({ label, hint, placeholder, multiline, rows, className, inputClassName, ...props }: TextInputProps) {
  return (
    <TextField {...props} className={tw(className, 'flex flex-col gap-1.5 min-w-0')}>
      {label && <Label className="text-body-sm leading-[1.3] font-medium text-ink-muted">{label}</Label>}
      {multiline
        ? <TextArea rows={rows} placeholder={placeholder} className={cx(FIELD, 'resize-y min-h-28', inputClassName)} />
        : <Input placeholder={placeholder} className={cx(FIELD, inputClassName)} />}
      {hint && <Text slot="description" className="text-caption text-ink-subtle">{hint}</Text>}
      {/* Error state is NOT specified by the design. When defined, add <FieldError> here and style data-invalid on FIELD. */}
    </TextField>
  );
}
