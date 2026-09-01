import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BackToSignInFooter } from "./back-to-sign-in-footer";

describe("BackToSignInFooter", () => {
  it("links back to /signin with a leading arrow", () => {
    render(<BackToSignInFooter />);

    const link = screen.getByRole("link", { name: /back to sign in/i });
    expect(link.getAttribute("href")).toBe("/signin");
    expect(link.querySelector("svg")).not.toBeNull();
  });
});