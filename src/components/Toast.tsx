"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import styles from "./Toast.module.css";

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
      <div aria-live="polite" className={styles.region}>
        {toasts.map((toast) => (
          <p key={toast.id} className={styles.toast}>
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
