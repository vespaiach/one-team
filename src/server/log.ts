export function writeLogLine(entry: Record<string, string | number>): void {
  process.stdout.write(`${JSON.stringify(entry)}\n`);
}