import type { ProjectColumnRow } from "../server/queries";

export function ColumnsSection({ columns }: { columns: ProjectColumnRow[] }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Kind</th>
          <th>Issues</th>
        </tr>
      </thead>
      <tbody>
        {columns.map((column) => (
          <tr key={column.id}>
            <td>{column.name}</td>
            <td>{column.kind}</td>
            <td>{column.issueCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}