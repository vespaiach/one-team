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
    return <p className="py-6 text-center text-(--color-text-muted)">No outstanding invitations</p>;
  }

  return (
    <table className="w-full text-left text-control">
      <thead>
        <tr>
          <th className="border-b border-(--color-divider) px-3 py-2 text-label text-(--color-text-muted)">
            Address
          </th>
          <th className="border-b border-(--color-divider) px-3 py-2 text-label text-(--color-text-muted)">
            Invited by
          </th>
          <th className="border-b border-(--color-divider) px-3 py-2 text-label text-(--color-text-muted)">
            Sent
          </th>
          <th className="border-b border-(--color-divider) px-3 py-2 text-label text-(--color-text-muted)">
            Expires
          </th>
          <th className="border-b border-(--color-divider) px-3 py-2 text-label text-(--color-text-muted)">
            Actions
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td className="border-b border-(--color-divider) px-3 py-2 text-(--color-text)">{row.email}</td>
            <td className="border-b border-(--color-divider) px-3 py-2 text-(--color-text)">
              {row.invitedByName}
            </td>
            <td className="border-b border-(--color-divider) px-3 py-2 font-mono">
              {DATE_FORMAT.format(row.sentAt)}
            </td>
            <td className="border-b border-(--color-divider) px-3 py-2 font-mono">
              {DATE_FORMAT.format(row.expiresAt)}
              {row.isExpired && <span> (expired)</span>}
            </td>
            <td className="border-b border-(--color-divider) px-3 py-2">
              <Button onPress={() => onResend(row.id)}>Resend</Button>
              <Button onPress={() => onRevoke(row.id)}>Revoke</Button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}