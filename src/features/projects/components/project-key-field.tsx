"use client";

import { useEffect, useState } from "react";
import { FieldError, Input, Label, TextField } from "react-aria-components/TextField";
import { deriveProjectKey, isValidProjectKey } from "../key";

const DEFAULT_DEBOUNCE_MS = 300;

export function ProjectKeyField({
  name,
  onChange,
  checkAvailability,
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: {
  name: string;
  onChange: (key: string) => void;
  checkAvailability: (key: string) => Promise<{ holder: { key: string; name: string } | null }>;
  debounceMs?: number;
}) {
  const [edited, setEdited] = useState(false);
  const [value, setValue] = useState(() => deriveProjectKey(name));
  const [holder, setHolder] = useState<{ key: string; name: string } | null>(null);

  useEffect(() => {
    if (edited) {
      return;
    }
    const derived = deriveProjectKey(name);
    setValue(derived);
    onChange(derived);
  }, [name, edited, onChange]);

  useEffect(() => {
    if (!isValidProjectKey(value)) {
      setHolder(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      checkAvailability(value).then((result) => {
        if (!cancelled) {
          setHolder(result.holder);
        }
      });
    }, debounceMs);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, debounceMs, checkAvailability]);

  function handleChange(raw: string) {
    const upper = raw.toUpperCase();
    setEdited(true);
    setValue(upper);
    setHolder(null);
    onChange(upper);
  }

  const requiredError = value === "" && name.trim() !== "";
  const clashError = holder !== null;

  return (
    <TextField
      value={value}
      onChange={handleChange}
      isRequired
      isInvalid={requiredError || clashError}
      className="flex flex-col gap-[5px]">
      <Label>Key</Label>
      <Input />
      {requiredError && <FieldError>A key is required.</FieldError>}
      {clashError && holder && <FieldError>{holder.name} already uses this key.</FieldError>}
    </TextField>
  );
}