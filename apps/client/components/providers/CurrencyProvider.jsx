"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { formatNaira, formatUsd } from "@josstay/shared";

const CurrencyContext = createContext(null);

export function CurrencyProvider({ children }) {
  const [currency, setCurrency] = useState("NGN");

  useEffect(() => {
    const stored = window.localStorage.getItem("josstay-currency");
    if (stored === "NGN" || stored === "USD") setCurrency(stored);
  }, []);

  const toggle = useCallback(() => {
    setCurrency((current) => {
      const next = current === "NGN" ? "USD" : "NGN";
      window.localStorage.setItem("josstay-currency", next);
      return next;
    });
  }, []);

  const format = useCallback(
    (amount) => (currency === "NGN" ? formatNaira(amount) : formatUsd(amount)),
    [currency]
  );

  const secondary = useCallback(
    (amount) => (currency === "NGN" ? formatUsd(amount) : formatNaira(amount)),
    [currency]
  );

  const value = useMemo(
    () => ({ currency, setCurrency, toggle, format, secondary }),
    [currency, toggle, format, secondary]
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export const useCurrency = () => {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside CurrencyProvider");
  return ctx;
};
