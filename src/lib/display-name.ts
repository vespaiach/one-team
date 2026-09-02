export function displayName(person: { firstName: string; lastName: string }): string {
  return `${person.firstName} ${person.lastName}`;
}