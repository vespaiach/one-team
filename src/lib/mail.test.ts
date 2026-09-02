import nodemailer from "nodemailer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendMail } from "./mail";

const ORIGINAL_ENV = {
  SMTP_URL: process.env.SMTP_URL,
  MAIL_FROM: process.env.MAIL_FROM,
};

beforeEach(() => {
  process.env.SMTP_URL = "smtp://localhost:1025";
  process.env.MAIL_FROM = "no-reply@example.com";
});

afterEach(() => {
  process.env.SMTP_URL = ORIGINAL_ENV.SMTP_URL;
  process.env.MAIL_FROM = ORIGINAL_ENV.MAIL_FROM;
  vi.restoreAllMocks();
});

describe("sendMail (F-3, B-6)", () => {
  it("returns sent when the transport delivers the message", async () => {
    const transportSendMail = vi.fn().mockResolvedValue(undefined);
    vi.spyOn(nodemailer, "createTransport").mockReturnValue({
      sendMail: transportSendMail,
    } as unknown as ReturnType<typeof nodemailer.createTransport>);

    const outcome = await sendMail({ to: "ada@example.com", subject: "Hello", text: "hi" });

    expect(outcome).toBe("sent");
    expect(transportSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "no-reply@example.com",
        to: "ada@example.com",
        subject: "Hello",
        text: "hi",
      }),
    );
  });

  it("returns not_sent and never throws when SMTP_URL is unset", async () => {
    process.env.SMTP_URL = "";
    const createTransport = vi.spyOn(nodemailer, "createTransport");

    const outcome = await sendMail({ to: "ada@example.com", subject: "Hello", text: "hi" });

    expect(outcome).toBe("not_sent");
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("returns not_sent and never throws when MAIL_FROM is unset", async () => {
    process.env.MAIL_FROM = "";
    const createTransport = vi.spyOn(nodemailer, "createTransport");

    const outcome = await sendMail({ to: "ada@example.com", subject: "Hello", text: "hi" });

    expect(outcome).toBe("not_sent");
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("returns not_sent and never throws when the transport rejects", async () => {
    const transportSendMail = vi.fn().mockRejectedValue(new Error("connection refused"));
    vi.spyOn(nodemailer, "createTransport").mockReturnValue({
      sendMail: transportSendMail,
    } as unknown as ReturnType<typeof nodemailer.createTransport>);

    await expect(sendMail({ to: "ada@example.com", subject: "Hello", text: "hi" })).resolves.toBe("not_sent");
  });
});