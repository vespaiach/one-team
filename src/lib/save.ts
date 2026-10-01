const retryToast = "Couldn't save. Try again.";
const permissionToast = "You don't have permission to do that.";

type SaveResult<T> =
  | { ok: true; data: T }
  | { ok: false; fields: Record<string, string> }
  | { ok: false; toast: string };

export async function saveJson<T>(url: string, body: unknown): Promise<SaveResult<T>> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (response.ok) {
      return { ok: true, data: (await response.json()) as T };
    }
    if (response.status === 403) {
      return { ok: false, toast: permissionToast };
    }
    if (response.status === 422) {
      const payload = await response.json().catch(() => null);
      const fields = payload?.error?.fields;
      if (fields) {
        return { ok: false, fields };
      }
    }
    return { ok: false, toast: retryToast };
  } catch {
    return { ok: false, toast: retryToast };
  }
}