export function progressBarWidths(counts: { done: number; counted: number }): {
  donePercent: number;
  todoPercent: number;
} {
  if (counts.counted === 0) {
    return { donePercent: 0, todoPercent: 0 };
  }
  const donePercent = Math.round((counts.done / counts.counted) * 100);
  return { donePercent, todoPercent: 100 - donePercent };
}