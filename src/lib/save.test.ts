import { afterEach, describe, expect, it, vi } from "vitest";
import { saveJson } from "./save.ts";

const retryToast = "Couldn't save. Try again.";
const permissionToast = "You don't have permission to do that.";

function stubFetch(status: number, body: unknown) {
  const fetchMock = vi.fn(async () =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("saveJson", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("posts the body as JSON to the url", async () => {
    const fetchMock = stubFetch(201, { id: 1 });

    await saveJson("/api/things", { name: "Alpha" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/things");
    expect(init.method).toBe("POST");
    expect(new Headers(init.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(init.body as string)).toEqual({ name: "Alpha" });
  });

  it.each([200, 201])("returns the data on %i", async (status) => {
    stubFetch(status, { id: 7, name: "Alpha" });

    expect(await saveJson("/api/things", { name: "Alpha" })).toEqual({
      ok: true,
      data: { id: 7, name: "Alpha" },
    });
  });

  it("returns the field errors on a 422 with fields", async () => {
    stubFetch(422, { error: { message: "Invalid input", fields: { name: "Enter a name." } } });

    expect(await saveJson("/api/things", { name: "" })).toEqual({
      ok: false,
      fields: { name: "Enter a name." },
    });
  });

  it("returns the permission toast on a 403", async () => {
    stubFetch(403, { error: { message: permissionToast } });

    expect(await saveJson("/api/things", { name: "Alpha" })).toEqual({
      ok: false,
      toast: permissionToast,
    });
  });

  it.each([
    [400, { error: { message: "Bad request" } }],
    [401, { error: { message: "Sign in" } }],
    [404, { error: { message: "Not found" } }],
    [409, { error: { message: "Conflict" } }],
    [422, { error: { message: "Invalid input" } }],
    [500, { error: { message: "Something went wrong." } }],
    [502, "<html>Bad gateway</html>"],
    [503, ""],
  ])("returns the retry toast on a %i", async (status, body) => {
    stubFetch(status, body);

    expect(await saveJson("/api/things", { name: "Alpha" })).toEqual({
      ok: false,
      toast: retryToast,
    });
  });

  it("returns the retry toast when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );

    expect(await saveJson("/api/things", { name: "Alpha" })).toEqual({
      ok: false,
      toast: retryToast,
    });
  });
});
