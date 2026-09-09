const PLACEHOLDER_ROW_COUNT = 3;

const TABLE_HEADER_CLASSES = "px-3 py-2 text-start font-sans text-label text-(--color-text-muted)";
const TABLE_CELL_CLASSES = "px-3 py-2";

export function RosterSkeleton() {
  return (
    <table
      aria-busy="true"
      className="w-full border-collapse text-control">
      <thead>
        <tr className="border-(--color-border) border-b">
          <th className={TABLE_HEADER_CLASSES}>Avatar</th>
          <th className={TABLE_HEADER_CLASSES}>Name</th>
          <th className={TABLE_HEADER_CLASSES}>Email</th>
          <th className={TABLE_HEADER_CLASSES}>Role</th>
          <th className={TABLE_HEADER_CLASSES}>Joined</th>
          <th className={TABLE_HEADER_CLASSES}>Projects</th>
          <th className={TABLE_HEADER_CLASSES}>Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-(--color-divider)">
        {Array.from({ length: PLACEHOLDER_ROW_COUNT }).map((_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows carry no identity
          <tr key={index}>
            <td className={TABLE_CELL_CLASSES}>
              <div className="h-8 w-8 animate-pulse rounded-full bg-(--color-divider)" />
            </td>
            <td className={TABLE_CELL_CLASSES}>
              <div className="h-4 w-28 animate-pulse bg-(--color-divider)" />
            </td>
            <td className={TABLE_CELL_CLASSES}>
              <div className="h-4 w-36 animate-pulse bg-(--color-divider)" />
            </td>
            <td className={TABLE_CELL_CLASSES}>
              <div className="h-4 w-16 animate-pulse bg-(--color-divider)" />
            </td>
            <td className={TABLE_CELL_CLASSES}>
              <div className="h-4 w-20 animate-pulse bg-(--color-divider)" />
            </td>
            <td className={TABLE_CELL_CLASSES}>
              <div className="h-4 w-8 animate-pulse bg-(--color-divider)" />
            </td>
            <td className={TABLE_CELL_CLASSES}>
              <div className="h-4 w-20 animate-pulse bg-(--color-divider)" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}