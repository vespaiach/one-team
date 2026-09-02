import "server-only";
import { sendMail } from "@/lib/mail";
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
  const link = buildResetLink(params.token);
  const outcome = await sendMail({
    to: params.to,
    subject: "Reset your password",
    text: `Reset your password: ${link}`,
  });

  if (outcome === "not_sent") {
    logMailSendFailure(params.to);
  }
}