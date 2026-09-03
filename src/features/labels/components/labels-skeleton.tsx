const PLACEHOLDER_ROW_COUNT = 3;

export function LabelsSkeleton() {
  return (
    <table aria-busy="true">
      <thead>
        <tr>
          <th>Name</th>
          <th>Issues</th>
          <th>Edit</th>
          <th>Delete</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: PLACEHOLDER_ROW_COUNT }).map((_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows carry no identity
          <tr key={index}>
            <td>
              <div className="h-4 w-28 animate-pulse bg-(--color-divider)" />
            </td>
            <td>
              <div className="h-4 w-8 animate-pulse bg-(--color-divider)" />
            </td>
            <td>
              <div className="h-4 w-10 animate-pulse bg-(--color-divider)" />
            </td>
            <td>
              <div className="h-4 w-10 animate-pulse bg-(--color-divider)" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}