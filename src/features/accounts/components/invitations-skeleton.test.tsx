import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InvitationsSkeleton } from "./invitations-skeleton";
import { InvitationsTable } from "./invitations-table";

describe("InvitationsSkeleton (FR-055)", () => {
  it("renders the same table regions as InvitationsTable, so nothing shifts when data lands", () => {
    const { container: skeletonContainer } = render(<InvitationsSkeleton />);
    const { container: tableContainer } = render(
      <InvitationsTable
        rows={[
          {
            id: "inv-1",
            email: "invitee@example.com",
            invitedByName: "Grace Hopper",
            sentAt: new Date(),
            expiresAt: new Date(),
            isExpired: false,
          },
        ]}
        onResend={() => undefined}
        onRevoke={() => undefined}
      />,
    );

    const skeletonHeaders = skeletonContainer.querySelectorAll("th");
    const tableHeaders = tableContainer.querySelectorAll("th");
    expect(skeletonHeaders).toHaveLength(tableHeaders.length);
    expect(Array.from(skeletonHeaders).map((th) => th.textContent)).toEqual(
      Array.from(tableHeaders).map((th) => th.textContent),
    );
  });

  it("renders a fixed row count of placeholder rows", () => {
    render(<InvitationsSkeleton />);

    const rows = screen.getAllByRole("row");
    expect(rows.length).toBeGreaterThan(1);
  });

  it("marks itself as a busy region for assistive technology", () => {
    const { container } = render(<InvitationsSkeleton />);

    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
  });
});