import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RosterSkeleton } from "./roster-skeleton";
import { RosterTable } from "./roster-table";

describe("RosterSkeleton (FR-055)", () => {
  it("renders the same table regions as RosterTable, so nothing shifts when data lands", () => {
    const { container: skeletonContainer } = render(<RosterSkeleton />);
    const { container: tableContainer } = render(
      <RosterTable
        rows={[
          {
            id: "acc-1",
            firstName: "Grace",
            lastName: "Hopper",
            displayName: "Grace Hopper",
            avatarUrl: null,
            email: "grace@example.com",
            role: "member",
            joinedAt: new Date(),
            isActive: true,
            projectCount: 0,
          },
        ]}
        activeAdminCount={1}
        highlightedAccountId={null}
        onClearHighlight={() => undefined}
        onDeactivate={() => undefined}
        onReactivate={() => undefined}
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
    const { container } = render(<RosterSkeleton />);

    expect(container.querySelectorAll("tbody tr").length).toBeGreaterThan(1);
  });

  it("marks itself as a busy region for assistive technology", () => {
    const { container } = render(<RosterSkeleton />);

    expect(container.querySelector("[aria-busy='true']")).not.toBeNull();
  });
});