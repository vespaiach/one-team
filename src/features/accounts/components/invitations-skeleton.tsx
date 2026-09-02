const PLACEHOLDER_ROW_COUNT = 3;

export function InvitationsSkeleton() {
  return (
    <table aria-busy="true">
      <thead>
        <tr>
          <th>Address</th>
          <th>Invited by</th>
          <th>Sent</th>
          <th>Expires</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: PLACEHOLDER_ROW_COUNT }).map((_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows carry no identity
          <tr key={index}>
            <td>
              <div className="h-4 w-32 animate-pulse bg-(--color-divider)" />
            </td>
            <td>
              <div className="h-4 w-24 animate-pulse bg-(--color-divider)" />
            </td>
            <td>
              <div className="h-4 w-20 animate-pulse bg-(--color-divider)" />
            </td>
            <td>
              <div className="h-4 w-20 animate-pulse bg-(--color-divider)" />
            </td>
            <td>
              <div className="h-4 w-16 animate-pulse bg-(--color-divider)" />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}