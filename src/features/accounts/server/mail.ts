import "server-only";
import { type MailOutcome, sendMail } from "@/lib/mail";

function buildInviteLink(token: string): string {
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    throw new Error("APP_URL is not set");
  }
  const url = new URL("/invite/accept", appUrl);
  url.searchParams.set("token", token);
  return url.toString();
}

export async function sendInvitationMail(params: {
  to: string;
  token: string;
  expiresAt: Date;
}): Promise<MailOutcome> {
  const link = buildInviteLink(params.token);

  return sendMail({
    to: params.to,
    subject: "You've been invited",
    text: `An administrator has invited you to join. Accept the invitation: ${link}\nThis link expires on ${params.expiresAt.toISOString()}.`,
  });
}