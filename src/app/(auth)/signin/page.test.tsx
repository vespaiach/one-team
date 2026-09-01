import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SignInPage, { metadata } from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => {
  cleanup();
});

async function renderPage(searchParams: Record<string, string | string[] | undefined> = {}) {
  const jsx = await SignInPage({ params: Promise.resolve({}), searchParams: Promise.resolve(searchParams) });
  render(jsx);
}

describe("/signin page (FR-012, FR-060, FR-079)", () => {
  it("sets its own document title", () => {
    expect(metadata.title).toBe("Sign in");
  });

  it("carries exactly one <h1>", async () => {
    await renderPage();

    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Sign in");
  });

  it("renders no sign-up link and no remember-me control", async () => {
    await renderPage();

    expect(screen.queryByText(/sign up/i)).toBeNull();
    expect(screen.queryByText(/remember me/i)).toBeNull();
    expect(screen.queryByRole("checkbox")).toBeNull();
  });

  it("renders the sub-line telling the visitor which email to use", async () => {
    await renderPage();

    expect(screen.getByText("Use the email your invitation was sent to.")).not.toBeNull();
  });

  it("renders the form even to a caller who already holds a session", async () => {
    await renderPage();

    expect(screen.getByLabelText("Email")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Sign in" })).not.toBeNull();
  });

  it("honours ?reset=done and renders the success banner", async () => {
    await renderPage({ reset: "done" });

    expect(screen.getByText("Your password has been changed. Sign in with it now.")).not.toBeNull();
  });

  it("honours no other query parameter", async () => {
    await renderPage({ reset: "nope", error: "throttled" });

    expect(screen.queryByText("Your password has been changed. Sign in with it now.")).toBeNull();
  });
});