"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

type ToastApi = { showToast: (text: string) => void };

const ToastContext = createContext<ToastApi>({ showToast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const nextId = useRef(0);

  const showToast = useCallback((text: string) => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, text }]);
    setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 5000);
  }, []);

  const api = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext value={api}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed right-6 bottom-6 z-1 flex w-[360px] max-w-[calc(100%-24px)] flex-col gap-2 max-md:right-3 max-md:bottom-3 max-md:left-3 max-md:w-auto max-md:max-w-none">
        {toasts.map((toast) => (
          <p
            key={toast.id}
            className="rounded-md bg-inverse-canvas px-4 py-3 font-text text-body-sm text-inverse-ink wrap-anywhere">
            {toast.text}
          </p>
        ))}
      </div>
    </ToastContext>
  );
}

export function useToast() {
  return useContext(ToastContext);
}