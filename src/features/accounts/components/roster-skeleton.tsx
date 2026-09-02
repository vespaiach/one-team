const PLACEHOLDER_ROW_COUNT = 3;

export function RosterSkeleton() {
  return (
    <table aria-busy="true">
      <thead>
        <tr>
          <th>Avatar</th>
          <th>Name</th>
          <th>Email</th>
          <th>Role</th>
          <th>Joined</th>
          <th>Projects</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: PLACEHOLDER_ROW_COUNT }).map((_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows carry no identity
          <tr key={index}>
            <td>
              <div className="h-8 w-8 animate-pulse rounded-full bg-(--color-divider)" />
            </td>
            <td>
              <div className="h-4 w-28 animate-pulse bg-(--color-divider)" />
            </td>
            <td>
              <div className="h-4 w-36 animate-pulse bg-(--color-divider)" />
            </td>
            <td>
              <div className="h-4 w-16 animate-pulse bg-(--color-divider)" />
            </td>
            <td>
              <div className="h-4 w-20 animate-pulse bg-(--color-divider)" />
            </td>
            <td>
              <div className="h-4 w-8 animate-pulse bg-(--color-divider)" />
            </td>
            <td>
              <div className="h-4 w-20 animate-pulse bg-(--color-divider)" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}