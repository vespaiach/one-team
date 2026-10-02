import { isValidEmail } from "./emailAddress.ts";

type Settings = {
  databaseUrl: string;
};

type EmailSettings = { kind: "resend"; apiKey: string } | { kind: "mailpit"; host: string; port: number };

type AppSettings = {
  appUrl: string;
  emailFrom: string;
  email: EmailSettings;
};

export function readSettings(): Settings {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("Missing setting: DATABASE_URL");
  }
  return { databaseUrl };
}

function requiredSetting(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing setting: ${name}`);
  }
  return value;
}

function invalidSetting(name: string): Error {
  return new Error(`Invalid setting: ${name}`);
}

function isAppOrigin(value: string): boolean {
  if (!URL.canParse(value)) {
    return false;
  }
  const url = new URL(value);
  return (url.protocol === "http:" || url.protocol === "https:") && url.origin === value;
}

function readEmailSettings(): EmailSettings {
  if (process.env.NODE_ENV === "production") {
    return { kind: "resend", apiKey: requiredSetting("RESEND_API_KEY") };
  }
  const host = requiredSetting("MAILPIT_HOST");
  const portText = requiredSetting("MAILPIT_PORT");
  const port = Number(portText);
  if (!/^\d+$/.test(portText) || port < 1 || port > 65535) {
    throw invalidSetting("MAILPIT_PORT");
  }
  return { kind: "mailpit", host, port };
}

export function readAppSettings(): AppSettings {
  const appUrl = requiredSetting("APP_URL");
  if (!isAppOrigin(appUrl)) {
    throw invalidSetting("APP_URL");
  }
  const emailFrom = requiredSetting("EMAIL_FROM");
  if (!isValidEmail(emailFrom)) {
    throw invalidSetting("EMAIL_FROM");
  }
  return { appUrl, emailFrom, email: readEmailSettings() };
}