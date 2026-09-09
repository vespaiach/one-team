import { Button } from "react-aria-components/Button";
import type { InvitationRow } from "../server/roster";

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" });

const TABLE_HEADER_CLASSES = "px-3 py-2 text-start font-sans text-label text-(--color-text-muted)";
const TABLE_CELL_CLASSES = "px-3 py-2";

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
    <table className="w-full border-collapse text-control">
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
        {rows.map((row) => (
          <tr key={row.id}>
            <td className={TABLE_CELL_CLASSES}>{row.email}</td>
            <td className={TABLE_CELL_CLASSES}>{row.invitedByName}</td>
            <td className={TABLE_CELL_CLASSES}>
              <span className="font-mono">{DATE_FORMAT.format(row.sentAt)}</span>
            </td>
            <td className={TABLE_CELL_CLASSES}>
              <span className="font-mono">{DATE_FORMAT.format(row.expiresAt)}</span>
              {row.isExpired && <span> (expired)</span>}
            </td>
            <td className={`${TABLE_CELL_CLASSES} flex gap-2`}>
              <Button onPress={() => onResend(row.id)}>Resend</Button>
              <Button onPress={() => onRevoke(row.id)}>Revoke</Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}