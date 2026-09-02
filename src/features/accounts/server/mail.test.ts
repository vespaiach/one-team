import nodemailer from "nodemailer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendInvitationMail } from "./mail";

const ORIGINAL_ENV = {
  APP_URL: process.env.APP_URL,
  SMTP_URL: process.env.SMTP_URL,
  MAIL_FROM: process.env.MAIL_FROM,
};

beforeEach(() => {
  process.env.APP_URL = "https://app.example.com";
  process.env.SMTP_URL = "smtp://localhost:1025";
  process.env.MAIL_FROM = "no-reply@example.com";
});

afterEach(() => {
  process.env.APP_URL = ORIGINAL_ENV.APP_URL;
  process.env.SMTP_URL = ORIGINAL_ENV.SMTP_URL;
  process.env.MAIL_FROM = ORIGINAL_ENV.MAIL_FROM;
  vi.restoreAllMocks();
});

describe("sendInvitationMail (FR-013a, FR-017)", () => {
  it("returns its outcome, carrying the installation, that an administrator issued it, the link and the expiry instant", async () => {
    const transportSendMail = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(nodemailer, "createTransport").mockReturnValue({
      sendMail: transportSendMail,
    } as unknown as ReturnType<typeof nodemailer.createTransport>);

    const expiresAt = new Date("2026-01-08T00:00:00.000Z");
    const outcome = await sendInvitationMail({
      to: "invitee@example.com",
      token: "the-token-value",
      expiresAt,
    });

    expect(outcome).toBe("sent");
    const call = transportSendMail.mock.calls[0]?.[0];
    expect(call.to).toBe("invitee@example.com");
    expect(call.from).toBe("no-reply@example.com");
    expect(String(call.text)).toContain("https://app.example.com/invite/accept?token=the-token-value");
    expect(String(call.text)).toContain("administrator");
    expect(String(call.text)).toContain(expiresAt.toISOString());
  });

  it("names neither the issuing admin nor any other account", async () => {
    const transportSendMail = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(nodemailer, "createTransport").mockReturnValue({
      sendMail: transportSendMail,
    } as unknown as ReturnType<typeof nodemailer.createTransport>);

    await sendInvitationMail({
      to: "invitee@example.com",
      token: "the-token-value",
      expiresAt: new Date("2026-01-08T00:00:00.000Z"),
    });

    const call = transportSendMail.mock.calls[0]?.[0];
    expect(String(call.text)).not.toMatch(/admin(?!istrator)/i);
  });

  it("returns not_sent when the transport is unreachable", async () => {
    const transportSendMail = vi.fn().mockRejectedValue(new Error("connection refused"));
    vi.spyOn(nodemailer, "createTransport").mockReturnValue({
      sendMail: transportSendMail,
    } as unknown as ReturnType<typeof nodemailer.createTransport>);

    await expect(
      sendInvitationMail({
        to: "invitee@example.com",
        token: "the-token-value",
        expiresAt: new Date("2026-01-08T00:00:00.000Z"),
      }),
    ).resolves.toBe("not_sent");
  });
});