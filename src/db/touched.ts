export function touched<T extends Record<string, unknown>>(values: T): T & { updatedAt: Date } {
  return { ...values, updatedAt: new Date() };
}