const KEY_PATTERN = /^[A-Z][A-Z0-9]{0,7}$/;
const MAX_KEY_LENGTH = 8;

export function isValidProjectKey(key: string): boolean {
  return KEY_PATTERN.test(key);
}

export function deriveProjectKey(name: string): string {
  const words = name.match(/\S+/g) ?? [];
  const candidate = words
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .slice(0, MAX_KEY_LENGTH);
  return isValidProjectKey(candidate) ? candidate : "";
}