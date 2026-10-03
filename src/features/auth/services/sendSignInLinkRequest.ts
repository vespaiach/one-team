type SignInLinkRequest = {
  email: string;
  requestId: string;
  next?: string;
};

type SignInLinkResult =
  | { kind: "checkEmail" }
  | { kind: "fields"; fields: Record<string, string> }
  | { kind: "limit" }
  | { kind: "sendFailed" }
  | { kind: "failed" };

export async function sendSignInLinkRequest(request: SignInLinkRequest): Promise<SignInLinkResult> {
  try {
    const response = await fetch("/api/sign-in-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    if (response.status === 200) {
      return { kind: "checkEmail" };
    }
    if (response.status === 429) {
      return { kind: "limit" };
    }
    if (response.status === 503) {
      return { kind: "sendFailed" };
    }
    if (response.status === 422) {
      const payload = await response.json().catch(() => null);
      const fields = payload?.error?.fields;
      if (fields) {
        return { kind: "fields", fields };
      }
    }
    return { kind: "failed" };
  } catch {
    return { kind: "failed" };
  }
}