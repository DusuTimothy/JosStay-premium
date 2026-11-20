"use client";

import { AuthProvider } from "./AuthProvider";
import { CurrencyProvider } from "./CurrencyProvider";
import { ToastProvider } from "./ToastProvider";
import { BookingProvider } from "./BookingProvider";

export function Providers({ children }) {
  return (
    <CurrencyProvider>
      <ToastProvider>
        <AuthProvider>
          <BookingProvider>{children}</BookingProvider>
        </AuthProvider>
      </ToastProvider>
    </CurrencyProvider>
  );
}
