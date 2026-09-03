export function formatIssueKey(projectKey: string, number: number): string {
  return `${projectKey}-${number}`;
}