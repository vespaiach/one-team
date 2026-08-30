import "server-only";
import nodemailer from "nodemailer";
import { logMailSendFailure } from "./log";

function buildResetLink(token: string): string {
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    throw new Error("APP_URL is not set");
  }
  const url = new URL("/reset", appUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function sendPasswordResetMail(params: { to: string; token: string }): Promise<void> {
  const smtpUrl = process.env.SMTP_URL;
  const mailFrom = process.env.MAIL_FROM;

  if (!smtpUrl || !mailFrom) {
    logMailSendFailure(params.to);
    return;
  }

  const transport = nodemailer.createTransport(smtpUrl);
  const link = buildResetLink(params.token);

  try {
    await transport.sendMail({
      from: mailFrom,
      to: params.to,
      subject: "Reset your password",
      text: `Reset your password: ${link}`,
    });
  } catch {
    logMailSendFailure(params.to);
  }
}