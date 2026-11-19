"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getProperty, quoteStay, SEED_BOOKINGS } from "@josstay/shared";

const BookingContext = createContext(null);

const makeReference = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return `JS-${out}`;
};

export function BookingProvider({ children }) {
  const [draft, setDraftState] = useState(null);
  const [bookings, setBookings] = useState(SEED_BOOKINGS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const storedDraft = window.localStorage.getItem("josstay-draft");
      if (storedDraft) setDraftState(JSON.parse(storedDraft));

      const storedBookings = window.localStorage.getItem("josstay-bookings");
      if (storedBookings) {
        const parsed = JSON.parse(storedBookings);
        if (Array.isArray(parsed) && parsed.length) {
          const refs = new Set(parsed.map((b) => b.reference));
          const merged = [
            ...parsed,
            ...SEED_BOOKINGS.filter((b) => !refs.has(b.reference)),
          ];
          setBookings(merged);
        }
      }
    } catch {
      // Local storage is optional — the demo still works without it.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem("josstay-bookings", JSON.stringify(bookings));
  }, [bookings, hydrated]);

  const setDraft = useCallback((next) => {
    setDraftState(next);
    try {
      if (next) window.localStorage.setItem("josstay-draft", JSON.stringify(next));
      else window.localStorage.removeItem("josstay-draft");
    } catch {}
  }, []);

  const clearDraft = useCallback(() => setDraft(null), [setDraft]);

  const createBooking = useCallback((payload) => {
    const property = getProperty(payload.propertySlug);
    const quote = property
      ? quoteStay(property, payload.checkIn, payload.checkOut, {
          roomId: payload.roomId,
          airportPickup: payload.airportPickup,
          bundleDiscount: payload.bundle,
        })
      : null;

    const booking = {
      ...payload,
      reference: makeReference(),
      status: "upcoming",
      total: quote
        ? quote.total + (payload.bundleFlight?.flightTotal || 0)
        : payload.total || 0,
      createdAt: new Date().toISOString(),
    };

    setBookings((all) => [booking, ...all]);
    return booking;
  }, []);

  const cancelBooking = useCallback((reference) => {
    setBookings((all) =>
      all.map((b) => (b.reference === reference ? { ...b, status: "cancelled" } : b))
    );
  }, []);

  const getBooking = useCallback(
    (reference) => bookings.find((b) => b.reference === reference) || null,
    [bookings]
  );

  const value = useMemo(
    () => ({
      draft,
      setDraft,
      clearDraft,
      bookings,
      createBooking,
      cancelBooking,
      getBooking,
      hydrated,
    }),
    [draft, setDraft, clearDraft, bookings, createBooking, cancelBooking, getBooking, hydrated]
  );

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export const useBooking = () => {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error("useBooking must be used inside BookingProvider");
  return ctx;
};
