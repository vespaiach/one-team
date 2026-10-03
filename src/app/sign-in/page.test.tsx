import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MagicLinkLanding } from "../../features/auth/components/MagicLinkLanding.tsx";
import { SignInForm } from "../../features/auth/components/SignInForm.tsx";
import { db } from "../../server/db.ts";
import { currentMember } from "../../server/session.ts";
import { landingState } from "../../server/signIn.ts";
import SignInPage, { metadata } from "./page.tsx";

vi.mock("../../server/db.ts", () => ({ db: vi.fn() }));
vi.mock("../../server/session.ts", () => ({ currentMember: vi.fn() }));
vi.mock("../../server/signIn.ts", () => ({ landingState: vi.fn() }));
vi.mock("../../features/auth/components/SignInForm.tsx", () => ({
  SignInForm: vi.fn(() => <p>sign-in form</p>),
}));
vi.mock("../../features/auth/components/MagicLinkLanding.tsx", () => ({
  MagicLinkLanding: vi.fn(() => <p>magic-link landing</p>),
}));

type SearchParams = Record<string, string | string[] | undefined>;
type Member = Awaited<ReturnType<typeof currentMember>>;

const sql = { name: "test sql" } as unknown as ReturnType<typeof db>;
const alex = { id: 1, fullName: "Alex Doe", username: "alex", role: "member" } as NonNullable<Member>;
const signInForm = vi.mocked(SignInForm);
const landing = vi.mocked(MagicLinkLanding);

async function renderPage(searchParams: SearchParams) {
  render(await SignInPage({ searchParams: Promise.resolve(searchParams) }));
}

function formProps() {
  expect(signInForm).toHaveBeenCalled();
  return signInForm.mock.calls[0][0];
}

function landingProps() {
  expect(landing).toHaveBeenCalled();
  return landing.mock.calls[0][0];
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db).mockReturnValue(sql);
  vi.mocked(currentMember).mockResolvedValue(null);
  vi.mocked(landingState).mockResolvedValue({ state: "signIn" });
});

describe("Sign-in page", () => {
  it("has the document title Sign in", () => {
    expect(metadata.title).toBe("Sign in");
  });

  it("renders the sign-in form with the next value when there is no token", async () => {
    await renderPage({ next: "/project/WEB?tab=open" });

    expect(screen.getByText("sign-in form")).toBeTruthy();
    expect(screen.queryByText("magic-link landing")).toBeNull();
    expect(formProps().next).toBe("/project/WEB?tab=open");
  });

  it("passes the first next value when next is repeated", async () => {
    await renderPage({ next: ["/my-issues", "/project/WEB"] });

    expect(formProps().next).toBe("/my-issues");
  });

  it("renders the landing page with the token and the server-chosen state", async () => {
    await renderPage({ token: "k7Qm2xLp9sVb4nRt8wYz3cJd6fHg1aUe5iOo0pNq" });

    expect(screen.getByText("magic-link landing")).toBeTruthy();
    expect(screen.queryByText("sign-in form")).toBeNull();
    expect(landingState).toHaveBeenCalledWith(sql, {
      token: "k7Qm2xLp9sVb4nRt8wYz3cJd6fHg1aUe5iOo0pNq",
      member: null,
    });
    expect(landingProps()).toMatchObject({
      token: "k7Qm2xLp9sVb4nRt8wYz3cJd6fHg1aUe5iOo0pNq",
      initial: { state: "signIn" },
    });
  });

  it("uses the first token when token is repeated", async () => {
    await renderPage({ token: ["a", "b"] });

    expect(landingState).toHaveBeenCalledWith(sql, { token: "a", member: null });
    expect(landingProps().token).toBe("a");
  });

  it("renders the landing page for an empty token, never a 422", async () => {
    await renderPage({ token: "" });

    expect(screen.getByText("magic-link landing")).toBeTruthy();
    expect(landingState).toHaveBeenCalledWith(sql, { token: "", member: null });
    expect(landingProps()).toMatchObject({ token: "", initial: { state: "signIn" } });
  });

  it("renders the landing page rather than the form when both token and next are present", async () => {
    await renderPage({ token: "a", next: "/my-issues" });

    expect(screen.getByText("magic-link landing")).toBeTruthy();
    expect(signInForm).not.toHaveBeenCalled();
  });

  it("starts in signedInAsOther with the signed-in member's full name for a link that is not theirs", async () => {
    vi.mocked(currentMember).mockResolvedValue(alex);
    vi.mocked(landingState).mockResolvedValue({ state: "signedInAsOther", fullName: "Alex Doe" });

    await renderPage({ token: "k7Qm2xLp9sVb4nRt8wYz3cJd6fHg1aUe5iOo0pNq" });

    expect(landingState).toHaveBeenCalledWith(sql, {
      token: "k7Qm2xLp9sVb4nRt8wYz3cJd6fHg1aUe5iOo0pNq",
      member: alex,
    });
    expect(landingProps()).toMatchObject({
      token: "k7Qm2xLp9sVb4nRt8wYz3cJd6fHg1aUe5iOo0pNq",
      initial: { state: "signedInAsOther", fullName: "Alex Doe" },
    });
  });
});