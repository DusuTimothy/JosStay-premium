"use client";

import { createContext, useCallback, useContext, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback((message, tone = "default") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((all) => [...all, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((all) => all.filter((t) => t.id !== id));
    }, 3600);
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((all) => all.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[70] flex flex-col items-center gap-2 px-4 sm:bottom-6">
        {toasts.map((t) => (
          <button
            key={t.id}
            onClick={() => dismiss(t.id)}
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl px-4 py-3 text-left text-sm shadow-float animate-slide-up ${
              t.tone === "error"
                ? "bg-red-600 text-white"
                : t.tone === "success"
                  ? "bg-emerald-700 text-white"
                  : "bg-ink text-white"
            }`}
          >
            <span className="mt-0.5 text-base leading-none">
              {t.tone === "error" ? "!" : t.tone === "success" ? "✓" : "•"}
            </span>
            <span className="flex-1">{t.message}</span>
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
};
