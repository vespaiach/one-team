const PLACEHOLDER_ROW_COUNT = 3;

const TABLE_HEADER_CLASSES = "px-3 py-2 text-start font-sans text-label text-(--color-text-muted)";
const TABLE_CELL_CLASSES = "px-3 py-2";

export function InvitationsSkeleton() {
  return (
    <table
      aria-busy="true"
      className="w-full border-collapse text-control">
      <thead>
        <tr className="border-(--color-border) border-b">
          <th className={TABLE_HEADER_CLASSES}>Address</th>
          <th className={TABLE_HEADER_CLASSES}>Invited by</th>
          <th className={TABLE_HEADER_CLASSES}>Sent</th>
          <th className={TABLE_HEADER_CLASSES}>Expires</th>
          <th className={TABLE_HEADER_CLASSES}>Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-(--color-divider)">
        {Array.from({ length: PLACEHOLDER_ROW_COUNT }).map((_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows carry no identity
          <tr key={index}>
            <td className={TABLE_CELL_CLASSES}>
              <div className="h-4 w-32 animate-pulse bg-(--color-divider)" />
            </td>
            <td className={TABLE_CELL_CLASSES}>
              <div className="h-4 w-24 animate-pulse bg-(--color-divider)" />
            </td>
            <td className={TABLE_CELL_CLASSES}>
              <div className="h-4 w-20 animate-pulse bg-(--color-divider)" />
            </td>
            <td className={TABLE_CELL_CLASSES}>
              <div className="h-4 w-20 animate-pulse bg-(--color-divider)" />
            </td>
            <td className={TABLE_CELL_CLASSES}>
              <div className="h-4 w-16 animate-pulse bg-(--color-divider)" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}