import * as React from 'react';

/**
 * Surface-1 field, 8px radius, 8px×12px padding. Focus: hairline-strong border + 2px primary-focus ring at 50%.
 * @startingPoint section="Forms" subtitle="Text input with label, hint and focus ring" viewport="700x300"
 */
export interface TextInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  id?: string;
  /** Renders a <textarea> */
  multiline?: boolean;
  rows?: number;
  /** Class on the wrapper */
  className?: string;
  /** Class on the input element (add "is-focused" to force the focus state in specimens) */
  inputClassName?: string;
}
export declare function TextInput(props: TextInputProps): React.JSX.Element;
