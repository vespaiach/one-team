import nodemailer from "nodemailer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendPasswordResetMail } from "./mail";

const ORIGINAL_ENV = {
  APP_URL: process.env.APP_URL,
  SMTP_URL: process.env.SMTP_URL,
  MAIL_FROM: process.env.MAIL_FROM,
};

let lines: string[] = [];

beforeEach(() => {
  process.env.APP_URL = "https://app.example.com";
  process.env.SMTP_URL = "smtp://localhost:1025";
  process.env.MAIL_FROM = "no-reply@example.com";
  lines = [];
  vi.spyOn(console, "error").mockImplementation((line: string) => {
    lines.push(line);
  });
});

afterEach(() => {
  process.env.APP_URL = ORIGINAL_ENV.APP_URL;
  process.env.SMTP_URL = ORIGINAL_ENV.SMTP_URL;
  process.env.MAIL_FROM = ORIGINAL_ENV.MAIL_FROM;
  vi.restoreAllMocks();
});

function parseLine(line: string): { event: string; at: string; subject: string } {
  return JSON.parse(line);
}

describe("sendPasswordResetMail (FR-033, FR-065, FR-064)", () => {
  it("sends the reset link as an absolute URL built from APP_URL, from MAIL_FROM", async () => {
    const sendMail = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(nodemailer, "createTransport").mockReturnValue({ sendMail } as unknown as ReturnType<
      typeof nodemailer.createTransport
    >);

    await sendPasswordResetMail({ to: "ada@example.com", token: "the-token-value" });

    expect(sendMail).toHaveBeenCalledTimes(1);
    const call = sendMail.mock.calls[0]?.[0];
    expect(call.from).toBe("no-reply@example.com");
    expect(call.to).toBe("ada@example.com");
    expect(String(call.text)).toContain("https://app.example.com/reset?token=the-token-value");
  });

  it("logs the failure and sends nothing when MAIL_FROM is unset, leaving the caller unaware", async () => {
    process.env.MAIL_FROM = "";
    const createTransport = vi.spyOn(nodemailer, "createTransport");

    await expect(sendPasswordResetMail({ to: "ada@example.com", token: "t" })).resolves.toBeUndefined();

    expect(createTransport).not.toHaveBeenCalled();
    expect(lines).toHaveLength(1);
    expect(parseLine(lines[0] ?? "").event).toBe("mail_send_failure");
    expect(parseLine(lines[0] ?? "").subject).toBe("ada@example.com");
  });

  it("logs the failure and resolves without throwing when the transport is unreachable", async () => {
    const sendMail = vi.fn().mockRejectedValue(new Error("connection refused"));
    vi.spyOn(nodemailer, "createTransport").mockReturnValue({ sendMail } as unknown as ReturnType<
      typeof nodemailer.createTransport
    >);

    await expect(sendPasswordResetMail({ to: "ada@example.com", token: "t" })).resolves.toBeUndefined();

    expect(lines).toHaveLength(1);
    expect(parseLine(lines[0] ?? "").event).toBe("mail_send_failure");
  });

  it("logs the failure and sends nothing when SMTP_URL is unset", async () => {
    process.env.SMTP_URL = "";
    const createTransport = vi.spyOn(nodemailer, "createTransport");

    await expect(sendPasswordResetMail({ to: "ada@example.com", token: "t" })).resolves.toBeUndefined();

    expect(createTransport).not.toHaveBeenCalled();
    expect(parseLine(lines[0] ?? "").event).toBe("mail_send_failure");
  });
});