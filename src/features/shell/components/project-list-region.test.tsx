import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProjectListRegion } from "./project-list-region";

describe("ProjectListRegion (FR-024, OT-UX-007)", () => {
  it("renders one quiet line reading exactly 'No projects yet.' with no illustration and no marketing (s8)", () => {
    render(<ProjectListRegion isAdmin={false} />);

    const line = screen.getByText("No projects yet.");
    expect(line.textContent).toBe("No projects yet.");
    expect(screen.queryByRole("img")).toBeNull();
    expect(line.className).toContain("text-(--color-text-muted)");
  });
});