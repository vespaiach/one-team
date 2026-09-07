export function progressPercent(done: number, counted: number): number {
  if (counted === 0) {
    return 0;
  }
  const rounded = Math.round((done / counted) * 100);
  return rounded === 100 && done < counted ? 99 : rounded;
}