import { Button } from "react-aria-components/Button";
import type { InvitationRow } from "../server/roster";

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

export function InvitationsTable({
  rows,
  onResend,
  onRevoke,
}: {
  rows: InvitationRow[];
  onResend: (invitationId: string) => void;
  onRevoke: (invitationId: string) => void;
}) {
  if (rows.length === 0) {
    return <p>No outstanding invitations</p>;
  }

  return (
    <table>
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
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{row.email}</td>
            <td>{row.invitedByName}</td>
            <td>{DATE_FORMAT.format(row.sentAt)}</td>
            <td>
              {DATE_FORMAT.format(row.expiresAt)}
              {row.isExpired && <span> (expired)</span>}
            </td>
            <td>
              <Button onPress={() => onResend(row.id)}>Resend</Button>
              <Button onPress={() => onRevoke(row.id)}>Revoke</Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}