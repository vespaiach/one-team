"use client";

import { useState } from "react";
import { Button } from "react-aria-components/Button";
import { FieldError, Input, Label, TextField } from "react-aria-components/TextField";
import { EyeIcon, EyeOffIcon, LockIcon, ShieldCheckIcon } from "./icons";

export function PasswordField({
  name,
  label,
  labelExtra,
  value,
  onChange,
  onBlur,
  isInvalid,
  isRequired,
  isDisabled,
  placeholder,
  errorMessage,
  hint,
  inputRef,
}: {
  name: string;
  label: string;
  labelExtra?: React.ReactNode;
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  isInvalid?: boolean;
  isRequired?: boolean;
  isDisabled?: boolean;
  placeholder?: string;
  errorMessage?: React.ReactNode;
  hint?: React.ReactNode;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  const [revealed, setRevealed] = useState(false);

  return (
    <TextField
      name={name}
      type={revealed ? "text" : "password"}
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      isInvalid={isInvalid}
      isRequired={isRequired}
      isDisabled={isDisabled}
      className="flex flex-col gap-[5px]">
      <div className="flex items-baseline justify-between">
        <Label className="text-[12px] text-[color-mix(in_srgb,var(--color-text)_70%,transparent)]">
          {label}
        </Label>
        {labelExtra}
      </div>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-[11px] -translate-y-1/2 text-[color-mix(in_srgb,var(--color-text)_45%,transparent)]">
          <LockIcon size={16} />
        </span>
        <Input
          ref={inputRef}
          placeholder={placeholder}
          className="h-[36px] w-full border border-[var(--color-divider)] bg-[var(--color-surface)] py-[6px] pr-[64px] pl-[36px] text-[14px] text-[var(--color-text)] caret-[var(--color-accent)] data-[invalid]:border-[var(--color-accent)] data-[disabled]:opacity-45"
        />
        {!isDisabled && (
          <Button
            type="button"
            onPress={() => setRevealed((current) => !current)}
            aria-label={revealed ? "Hide password" : "Show password"}
            className="absolute top-1/2 right-[10px] flex -translate-y-1/2 items-center justify-center p-[6px] text-[color-mix(in_srgb,var(--color-text)_45%,transparent)] data-[hovered]:text-[var(--color-text)]">
            {revealed ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
          </Button>
        )}
      </div>
      {isInvalid && errorMessage ? (
        <FieldError className="text-[12px] text-[var(--color-accent-700)]">{errorMessage}</FieldError>
      ) : (
        !isInvalid &&
        hint && (
          <div className="flex items-start gap-[7px] text-[12px] text-[color-mix(in_srgb,var(--color-text)_58%,transparent)]">
            <span className="mt-px flex-none text-[color-mix(in_srgb,var(--color-text)_62%,transparent)]">
              <ShieldCheckIcon size={16} />
            </span>
            <span>{hint}</span>
          </div>
        )
      )}
    </TextField>
  );
}