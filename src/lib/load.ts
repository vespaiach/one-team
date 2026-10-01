import { useCallback, useEffect, useState } from "react";

export function useLoad<T = unknown>(url: string) {
  const [result, setResult] = useState<{ state: "loading" | "loaded" | "error"; data: T | null }>({
    state: "loading",
    data: null,
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    fetch(url)
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const data = (await response.json()) as T;
        if (current) setResult({ state: "loaded", data });
      })
      .catch(() => {
        if (current) setResult({ state: "error", data: null });
      });
    return () => {
      current = false;
    };
  }, [url, attempt]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);

  return { state: result.state, data: result.data, retry };
}
