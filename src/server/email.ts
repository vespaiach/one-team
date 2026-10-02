import { readAppSettings } from "./config.ts";

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

export class EmailSendError extends Error {
  readonly status: number | "network";

  constructor(status: number | "network") {
    super(`Email send failed: ${status}`);
    this.name = "EmailSendError";
    this.status = status;
  }
}

function buildRequest({ to, subject, text }: EmailMessage): {
  url: string;
  headers: Record<string, string>;
  body: unknown;
} {
  const { emailFrom, email } = readAppSettings();
  if (email.kind === "resend") {
    return {
      url: "https://api.resend.com/emails",
      headers: { Authorization: `Bearer ${email.apiKey}` },
      body: { from: `Tracklite <${emailFrom}>`, to: [to], subject, text },
    };
  }
  return {
    url: `http://${email.host}:${email.port}/api/v1/send`,
    headers: {},
    body: {
      From: { Email: emailFrom, Name: "Tracklite" },
      To: [{ Email: to }],
      Subject: subject,
      Text: text,
    },
  };
}

export async function sendEmail(message: EmailMessage): Promise<void> {
  const { url, headers, body } = buildRequest(message);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new EmailSendError("network");
  }
  if (!response.ok) {
    throw new EmailSendError(response.status);
  }
}