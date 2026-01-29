"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

export type ToastType = "success" | "error";

export type Toast = {
  id: string;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = "success") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="fixed top-0 left-0 right-0 z-[100] flex flex-col items-center gap-2 px-4 pt-4 pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`
              pointer-events-auto flex w-full max-w-md items-center gap-2 rounded-lg border px-4 py-3 shadow-lg
              animate-[toast-in_0.3s_ease-out]
              ${t.type === "success"
                ? "border-green-200 bg-green-50 text-green-900 dark:border-green-800 dark:bg-green-900/30 dark:text-green-100"
                : "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-900/30 dark:text-red-100"}
            `}
          >
            {t.type === "success" && (
              <span className="shrink-0 text-lg" aria-hidden>✓</span>
            )}
            {t.type === "error" && (
              <span className="shrink-0 text-lg" aria-hidden>✕</span>
            )}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
