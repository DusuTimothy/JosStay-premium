"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, createIdempotencyKey } from "@/lib/api";
import { useAuth } from "./AuthProvider";

const BookingContext = createContext(null);

export function BookingProvider({ children }) {
  const auth = useAuth();
  const [draft, setDraftState] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [bookingsLoading, setBookingsLoading] = useState(false);
  const [bookingsError, setBookingsError] = useState("");

  useEffect(() => {
    try {
      const storedDraft = window.localStorage.getItem("josstay-draft");
      if (storedDraft) setDraftState(JSON.parse(storedDraft));
    } catch {
      // Local storage is optional.
    }
    setHydrated(true);
  }, []);

  const setDraft = useCallback((next) => {
    setDraftState(next);
    try {
      if (next) window.localStorage.setItem("josstay-draft", JSON.stringify(next));
      else window.localStorage.removeItem("josstay-draft");
    } catch {}
  }, []);

  const clearDraft = useCallback(() => setDraft(null), [setDraft]);

  const refreshBookings = useCallback(async (options = {}) => {
    if (!auth.isAuthenticated) {
      setBookings([]);
      setBookingsError("");
      return [];
    }

    setBookingsLoading(true);
    setBookingsError("");
    try {
      const res = await api.get("/api/bookings", { cache: "no-store", ...options });
      const list = Array.isArray(res?.data) ? res.data : [];
      setBookings(list);
      return list;
    } catch (error) {
      const message = error?.message || "Could not load bookings";
      setBookingsError(message);
      throw error;
    } finally {
      setBookingsLoading(false);
    }
  }, [auth.isAuthenticated]);

  useEffect(() => {
    if (!hydrated) return;
    if (auth.isLoading) return;
    if (!auth.isAuthenticated) {
      setBookings([]);
      setBookingsError("");
      return;
    }
    refreshBookings().catch(() => {});
  }, [hydrated, auth.isLoading, auth.isAuthenticated, refreshBookings]);

  const createBooking = useCallback(async (payload) => {
    const res = await api.post("/api/bookings", payload, {
      idempotencyKey: createIdempotencyKey(),
    });
    const booking = res?.data?.booking || res?.data || null;
    const payment = res?.data?.payment || null;

    if (booking?.reference) {
      setBookings((all) => {
        const idx = all.findIndex((b) => b.reference === booking.reference);
        if (idx === -1) return [booking, ...all];
        const next = [...all];
        next[idx] = { ...next[idx], ...booking };
        return next;
      });
    }

    return { booking, payment, raw: res };
  }, []);

  const cancelBooking = useCallback(async (reference) => {
    const res = await api.patch(`/api/bookings/${encodeURIComponent(reference)}/cancel`, {});
    const updated = res?.data || null;
    if (updated?.reference) {
      setBookings((all) => all.map((b) => (b.reference === updated.reference ? { ...b, ...updated } : b)));
    }
    return updated;
  }, []);

  const getBooking = useCallback(
    (reference) => bookings.find((b) => b.reference === reference) || null,
    [bookings],
  );

  const fetchBooking = useCallback(async (reference, options = {}) => {
    const res = await api.get(`/api/bookings/${encodeURIComponent(reference)}`, {
      cache: "no-store",
      ...options,
    });
    const booking = res?.data || null;
    if (booking?.reference) {
      setBookings((all) => {
        const idx = all.findIndex((b) => b.reference === booking.reference);
        if (idx === -1) return [booking, ...all];
        const next = [...all];
        next[idx] = { ...next[idx], ...booking };
        return next;
      });
    }
    return booking;
  }, []);

  const initializePayment = useCallback(async (reference) => {
    const res = await api.post(`/api/bookings/${encodeURIComponent(reference)}/payment/initialize`, {}, {
      idempotencyKey: createIdempotencyKey(),
    });
    const booking = res?.data?.booking || null;
    const payment = res?.data?.payment || null;

    if (booking?.reference) {
      setBookings((all) => {
        const idx = all.findIndex((b) => b.reference === booking.reference);
        if (idx === -1) return [booking, ...all];
        const next = [...all];
        next[idx] = { ...next[idx], ...booking };
        return next;
      });
    }

    return { booking, payment, raw: res };
  }, []);

  const value = useMemo(
    () => ({
      draft,
      setDraft,
      clearDraft,
      bookings,
      setBookings,
      bookingsLoading,
      bookingsError,
      refreshBookings,
      createBooking,
      cancelBooking,
      getBooking,
      fetchBooking,
      initializePayment,
      hydrated,
    }),
    [
      draft,
      setDraft,
      clearDraft,
      bookings,
      bookingsLoading,
      bookingsError,
      refreshBookings,
      createBooking,
      cancelBooking,
      getBooking,
      fetchBooking,
      initializePayment,
      hydrated,
    ],
  );

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export const useBooking = () => {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error("useBooking must be used inside BookingProvider");
  return ctx;
};
