const PLACEHOLDER_ROW_COUNT = 3;

export function LabelsSkeleton() {
  return (
    <table aria-busy="true">
      <thead>
        <tr className="border-b border-(--color-divider)">
          <th className="px-2 py-1 text-label text-(--color-text-muted)">Name</th>
          <th className="px-2 py-1 text-label text-(--color-text-muted)">Issues</th>
          <th className="px-2 py-1 text-label text-(--color-text-muted)">Edit</th>
          <th className="px-2 py-1 text-label text-(--color-text-muted)">Delete</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: PLACEHOLDER_ROW_COUNT }).map((_, index) => (
          <tr
            // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows carry no identity
            key={index}
            className="border-b border-(--color-divider)">
            <td className="px-2 py-1.5">
              <div className="h-4 w-28 animate-pulse bg-(--color-divider)" />
            </td>
            <td className="px-2 py-1.5">
              <div className="h-4 w-8 animate-pulse bg-(--color-divider)" />
            </td>
            <td className="px-2 py-1.5">
              <div className="h-4 w-10 animate-pulse bg-(--color-divider)" />
            </td>
            <td className="px-2 py-1.5">
              <div className="h-4 w-10 animate-pulse bg-(--color-divider)" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}