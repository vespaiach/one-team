export function splitOverflow<T>(items: readonly T[], limit: number): { shown: T[]; overflowCount: number } {
  if (items.length <= limit) {
    return { shown: [...items], overflowCount: 0 };
  }
  return { shown: items.slice(0, limit), overflowCount: items.length - limit };
}