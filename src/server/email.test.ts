import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendEmail } from "./email.ts";

const message = {
  to: "sam@acme.com",
  subject: "Sign in to Tracklite",
  text: "Use this link to sign in to Tracklite:\n\nhttp://localhost:3000/sign-in?token=abc\n",
};

const apiKey = "re_test_api_key_value";

type FetchCall = [string, RequestInit];

function stubFetch(answer: () => Promise<Response>) {
  const fetchMock = vi.fn((_url: string, _init: RequestInit) => answer());
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function onlyCall(fetchMock: ReturnType<typeof stubFetch>): FetchCall {
  expect(fetchMock).toHaveBeenCalledTimes(1);
  return fetchMock.mock.calls[0] as FetchCall;
}

function headersOf(init: RequestInit): Headers {
  return new Headers(init.headers);
}

function useLocalSettings() {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("APP_URL", "http://localhost:3000");
  vi.stubEnv("EMAIL_FROM", "tracklite@localhost");
  vi.stubEnv("MAILPIT_HOST", "localhost");
  vi.stubEnv("MAILPIT_PORT", "8025");
  vi.stubEnv("RESEND_API_KEY", apiKey);
}

function useProductionSettings() {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_URL", "https://tracklite.acme.com");
  vi.stubEnv("EMAIL_FROM", "tracklite@acme.com");
  vi.stubEnv("RESEND_API_KEY", apiKey);
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("sendEmail in local development", () => {
  beforeEach(() => {
    useLocalSettings();
  });

  it("posts the message as JSON to Mailpit's send API with no credentials", async () => {
    const fetchMock = stubFetch(async () => new Response('{"ID":"abc"}', { status: 200 }));

    await sendEmail(message);

    const [url, init] = onlyCall(fetchMock);
    expect(url).toBe("http://localhost:8025/api/v1/send");
    expect(init.method).toBe("POST");
    expect(headersOf(init).get("content-type")).toContain("application/json");
    expect(headersOf(init).has("authorization")).toBe(false);
    expect(JSON.parse(init.body as string)).toEqual({
      From: { Email: "tracklite@localhost", Name: "Tracklite" },
      To: [{ Email: "sam@acme.com" }],
      Subject: "Sign in to Tracklite",
      Text: message.text,
    });
  });

  it("FR-031 never calls api.resend.com outside production", async () => {
    const fetchMock = stubFetch(async () => new Response("{}", { status: 200 }));

    await sendEmail(message);

    for (const [url, init] of fetchMock.mock.calls as FetchCall[]) {
      expect(String(url)).not.toContain("api.resend.com");
      expect(JSON.stringify(init)).not.toContain(apiKey);
    }
  });
});

describe("sendEmail in production", () => {
  beforeEach(() => {
    useProductionSettings();
  });

  it("posts the message as JSON to Resend with the API key as a bearer token", async () => {
    const fetchMock = stubFetch(async () => new Response('{"id":"abc"}', { status: 200 }));

    await sendEmail(message);

    const [url, init] = onlyCall(fetchMock);
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    expect(headersOf(init).get("content-type")).toContain("application/json");
    expect(headersOf(init).get("authorization")).toBe(`Bearer ${apiKey}`);
    expect(JSON.parse(init.body as string)).toEqual({
      from: "Tracklite <tracklite@acme.com>",
      to: ["sam@acme.com"],
      subject: "Sign in to Tracklite",
      text: message.text,
    });
  });
});

describe.each([
  ["local development", useLocalSettings],
  ["production", useProductionSettings],
])("sendEmail failures in %s", (_, useSettings) => {
  beforeEach(() => {
    useSettings();
  });

  it.each([400, 401, 422, 500, 503])("throws on a %i answer", async (status) => {
    stubFetch(async () => new Response("{}", { status }));

    await expect(sendEmail(message)).rejects.toThrow();
  });

  it("throws when fetch rejects with a network error", async () => {
    stubFetch(async () => {
      throw new TypeError("fetch failed");
    });

    await expect(sendEmail(message)).rejects.toThrow();
  });

  it("throws when the send times out", async () => {
    const controller = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          const signal = init.signal as AbortSignal;
          if (signal.aborted) {
            reject(signal.reason);
            return;
          }
          signal.addEventListener("abort", () => reject(signal.reason));
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const sending = sendEmail(message);
    controller.abort(new DOMException("The operation was aborted due to timeout", "TimeoutError"));

    await expect(sending).rejects.toThrow();
  });

  it("passes a 10 second timeout signal to every call", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const fetchMock = stubFetch(async () => new Response("{}", { status: 200 }));

    await sendEmail(message);
    await sendEmail({ ...message, to: "alex@acme.com" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(timeout).toHaveBeenCalledTimes(2);
    expect(timeout).toHaveBeenNthCalledWith(1, 10_000);
    expect(timeout).toHaveBeenNthCalledWith(2, 10_000);
    for (const [index, [, init]] of (fetchMock.mock.calls as FetchCall[]).entries()) {
      expect(init.signal).toBeInstanceOf(AbortSignal);
      expect(init.signal).toBe(timeout.mock.results[index].value);
    }
  });
});