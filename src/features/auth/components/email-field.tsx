import { FieldError, Input, Label, TextField } from "react-aria-components/TextField";
import { MailIcon } from "./icons";

export function EmailField({
  name,
  label,
  value,
  onChange,
  onBlur,
  isInvalid,
  isRequired,
  isDisabled,
  placeholder,
  errorMessage,
  inputRef,
}: {
  name: string;
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  onBlur?: () => void;
  isInvalid?: boolean;
  isRequired?: boolean;
  isDisabled?: boolean;
  placeholder?: string;
  errorMessage?: React.ReactNode;
  inputRef?: React.Ref<HTMLInputElement>;
}) {
  return (
    <TextField
      name={name}
      type="email"
      value={value}
      onChange={onChange}
      onBlur={onBlur}
      isInvalid={isInvalid}
      isRequired={isRequired}
      isDisabled={isDisabled}
      className="flex flex-col gap-[5px]">
      <Label className="text-[12px] text-[color-mix(in_srgb,var(--color-text)_70%,transparent)]">
        {label}
      </Label>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-[11px] -translate-y-1/2 text-[color-mix(in_srgb,var(--color-text)_45%,transparent)]">
          <MailIcon size={16} />
        </span>
        <Input
          ref={inputRef}
          placeholder={placeholder}
          className="h-[36px] w-full border border-[var(--color-divider)] bg-[var(--color-surface)] py-[6px] pr-[10px] pl-[36px] text-[14px] text-[var(--color-text)] caret-[var(--color-accent)] data-[invalid]:border-[var(--color-accent)] data-[disabled]:opacity-45"
        />
      </div>
      {isInvalid && errorMessage && (
        <FieldError className="text-[12px] text-[var(--color-accent-700)]">{errorMessage}</FieldError>
      )}
    </TextField>
  );
}