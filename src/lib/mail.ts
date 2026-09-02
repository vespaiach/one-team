import "server-only";
import nodemailer from "nodemailer";

export type MailOutcome = "sent" | "not_sent";

export async function sendMail(params: { to: string; subject: string; text: string }): Promise<MailOutcome> {
  const smtpUrl = process.env.SMTP_URL;
  const mailFrom = process.env.MAIL_FROM;

  if (!smtpUrl || !mailFrom) {
    return "not_sent";
  }

  const transport = nodemailer.createTransport(smtpUrl);

  try {
    await transport.sendMail({
      from: mailFrom,
      to: params.to,
      subject: params.subject,
      text: params.text,
    });
    return "sent";
  } catch {
    return "not_sent";
  }
}