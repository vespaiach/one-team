import "server-only";

type AuthLogEvent =
  | "refused_sign_in"
  | "throttle_refusal"
  | "mail_send_failure"
  | "refused_first_run_seed"
  | "unhandled_server_error";

function writeAuthLogEntry(event: AuthLogEvent, subject: string): void {
  console.error(JSON.stringify({ event, at: new Date().toISOString(), subject }));
}

export function logRefusedSignIn(subject: string): void {
  writeAuthLogEntry("refused_sign_in", subject);
}

export function logThrottleRefusal(subject: string): void {
  writeAuthLogEntry("throttle_refusal", subject);
}

export function logMailSendFailure(subject: string): void {
  writeAuthLogEntry("mail_send_failure", subject);
}

export function logRefusedFirstRunSeed(subject: string): void {
  writeAuthLogEntry("refused_first_run_seed", subject);
}

export function logUnhandledServerError(subject: string): void {
  writeAuthLogEntry("unhandled_server_error", subject);
}