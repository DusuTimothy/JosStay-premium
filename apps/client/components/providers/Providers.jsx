"use client";

import { CurrencyProvider } from "./CurrencyProvider";
import { ToastProvider } from "./ToastProvider";
import { BookingProvider } from "./BookingProvider";

export function Providers({ children }) {
  return (
    <CurrencyProvider>
      <ToastProvider>
        <BookingProvider>{children}</BookingProvider>
      </ToastProvider>
    </CurrencyProvider>
  );
}
