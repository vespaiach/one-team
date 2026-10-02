import { afterEach, describe, expect, it, vi } from "vitest";
import { sendSignInLinkRequest } from "./sendSignInLinkRequest.ts";

const request = {
  email: "sam@acme.com",
  requestId: "6f1c2a8e-3b4d-4c5e-9f60-7a8b9c0d1e2f",
  next: "/project/WEB?tab=open",
};

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(
    async () =>
      new Response(typeof body === "string" ? body : JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("sendSignInLinkRequest", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the email, requestId and next as JSON to /api/sign-in-links", async () => {
    const fetchMock = stubFetch(200, { outcome: "checkEmail" });

    await sendSignInLinkRequest(request);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/sign-in-links");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual(request);
  });

  it("returns checkEmail on a 200", async () => {
    stubFetch(200, { outcome: "checkEmail" });

    expect(await sendSignInLinkRequest(request)).toEqual({ kind: "checkEmail" });
  });

  it("returns the field errors on a 422 with fields", async () => {
    stubFetch(422, {
      error: { message: "Invalid input", fields: { email: "Enter a valid email address." } },
    });

    expect(await sendSignInLinkRequest(request)).toEqual({
      kind: "fields",
      fields: { email: "Enter a valid email address." },
    });
  });

  it("returns limit on a 429", async () => {
    stubFetch(429, { error: { message: "Too many sign-in requests. Try again later." } });

    expect(await sendSignInLinkRequest(request)).toEqual({ kind: "limit" });
  });

  it("returns sendFailed on a 503", async () => {
    stubFetch(503, { error: { message: "We couldn't send the email. Try again." } });

    expect(await sendSignInLinkRequest(request)).toEqual({ kind: "sendFailed" });
  });

  it.each([
    [400, { error: { message: "Bad request" } }],
    [403, { error: { message: "Forbidden" } }],
    [404, { error: { message: "Not found" } }],
    [422, { error: { message: "Invalid input" } }],
    [500, { error: { message: "Something went wrong." } }],
    [502, "<html>Bad gateway</html>"],
  ])("returns failed on a %i", async (status, body) => {
    stubFetch(status, body);

    expect(await sendSignInLinkRequest(request)).toEqual({ kind: "failed" });
  });

  it("returns failed when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    expect(await sendSignInLinkRequest(request)).toEqual({ kind: "failed" });
  });
});