"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate } from "@josstay/shared";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useAuth, useBooking, useCurrency, useToast } from "@/components/providers";
import { supportWhatsAppUrl } from "@/lib/contact";
import { EmptyState, ErrorState, SkeletonCard } from "@/components/shared/states";

const TABS = [
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
  { id: "cancelled", label: "Cancelled" },
];

const statusLabel = (booking) => {
  if (booking?.status === "cancelled") return "Cancelled";
  if (booking?.status === "completed") return "Completed";
  if (booking?.paymentStatus && booking.paymentStatus !== "paid") return "Pending payment";
  return "Confirmed";
};

const statusBadge = (booking) => {
  if (booking?.status === "cancelled") return <Badge tone="danger" icon="x">Cancelled</Badge>;
  if (booking?.status === "completed") return <Badge tone="white" icon="checkCircle">Completed</Badge>;
  if (booking?.paymentStatus && booking.paymentStatus !== "paid") {
    return <Badge tone="warning" icon="alert">Pending payment</Badge>;
  }
  return <Badge tone="verified" icon="checkCircle">Confirmed</Badge>;
};

export function BookingsView() {
  const router = useRouter();
  const auth = useAuth();
  const {
    bookings,
    bookingsLoading,
    bookingsError,
    refreshBookings,
    cancelBooking,
    hydrated,
  } = useBooking();
  const { toast } = useToast();
  const { format } = useCurrency();
  const [tab, setTab] = useState("upcoming");
  const [cancelRef, setCancelRef] = useState(null);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    if (auth.isAuthenticated) {
      refreshBookings().catch(() => {});
    }
  }, [auth.isAuthenticated, refreshBookings]);

  const counts = useMemo(
    () => ({
      upcoming: bookings.filter((b) => b.status === "upcoming" || b.status === "confirmed").length,
      past: bookings.filter((b) => b.status === "completed").length,
      cancelled: bookings.filter((b) => b.status === "cancelled" || b.status === "no_show").length,
    }),
    [bookings],
  );

  const visible = useMemo(() => {
    const filtered = bookings.filter((b) => {
      if (tab === "upcoming") return b.status === "upcoming" || b.status === "confirmed";
      if (tab === "past") return b.status === "completed";
      if (tab === "cancelled") return b.status === "cancelled" || b.status === "no_show";
      return false;
    });
    return [...filtered].sort((a, b) => String(b.checkIn || "").localeCompare(String(a.checkIn || "")));
  }, [bookings, tab]);

  const selected = bookings.find((b) => b.reference === cancelRef) || null;

  const confirmCancel = async () => {
    if (!cancelRef || canceling) return;
    setCanceling(true);
    try {
      await cancelBooking(cancelRef);
      toast("Booking cancelled", "success");
      setCancelRef(null);
    } catch (error) {
      toast(error?.message || "Could not cancel booking", "error");
    } finally {
      setCanceling(false);
    }
  };

  if (!auth.isLoading && !auth.isAuthenticated) {
    return (
      <div className="container-page pb-16 pt-7 sm:pt-10">
        <EmptyState
          icon="calendar"
          title="Sign in to view your bookings"
          description="Your bookings are linked to your account so you can manage them securely from any device."
          actionLabel="Sign in"
          onAction={() => router.push("/account")}
        />
      </div>
    );
  }

  return (
    <div className="container-page pb-16 pt-7 sm:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">Your trips</span>
          <h1 className="mt-4 font-display text-[34px] font-bold leading-none tracking-tightest text-ink sm:text-[44px]">My bookings</h1>
          <p className="mt-3 text-[13px] text-muted">Manage upcoming stays, revisit past trips, or book again.</p>
        </div>
        <Button href="/search" variant="secondary" icon="search">Find another stay</Button>
      </div>

      <div className="mt-7 flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button key={t.id} type="button" onClick={() => setTab(t.id)} className={`chip shrink-0 ${active ? "chip-active" : ""}`} aria-pressed={active}>
              {t.label}
              <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${active ? "bg-white/20 text-white" : "bg-plum-50 text-plum-700"}`}>{counts[t.id] || 0}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-5 space-y-4">
        {(!hydrated || auth.isLoading || bookingsLoading) && bookings.length === 0 ? (
          <><SkeletonCard /><SkeletonCard /></>
        ) : bookingsError ? (
          <ErrorState
            title="Could not load your bookings"
            description={bookingsError}
            onRetry={() => refreshBookings().catch(() => {})}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon="calendar"
            title={tab === "upcoming" ? "No upcoming stays yet" : tab === "past" ? "No past stays yet" : "No cancelled bookings"}
            description={
              tab === "upcoming"
                ? "When you book a stay in Jos, it will show up here."
                : tab === "past"
                  ? "Completed trips will appear here."
                  : "Cancelled bookings will appear here."
            }
            actionLabel="Browse stays"
            onAction={() => router.push("/search")}
          />
        ) : (
          visible.map((booking) => {
            const canCancel = booking.status === "upcoming" || booking.status === "confirmed";
            const title = booking.propertyName || "Stay in Jos";
            const subtitle = [booking.roomName, booking.guests ? `${booking.guests} guest${booking.guests === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ");

            return (
              <article key={booking.reference} className="overflow-hidden rounded-xl border border-line bg-white shadow-card">
                <div className="flex flex-col">
                  <div className="flex flex-1 flex-col p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-2">{statusBadge(booking)}</div>
                        <h2 className="mt-1 truncate font-display text-[18px] font-bold text-ink">{title}</h2>
                        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted">
                          <span className="font-mono font-semibold text-ink">{booking.reference}</span>
                          {subtitle ? <><span className="text-line">|</span><span>{subtitle}</span></> : null}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-[17px] font-bold leading-none text-ink">{format((booking.total || 0) + (booking.paymentFee || 0))}</p>
                        <p className="mt-1 text-[10px] text-muted">{booking.paymentStatus === "paid" ? "Paid" : statusLabel(booking)}</p>
                      </div>
                    </div>

                    <div className="mt-3.5 grid grid-cols-2 gap-2 rounded-lg bg-canvas p-3 sm:grid-cols-4">
                      {[
                        { label: "Check-in", value: booking.checkIn ? formatDate(booking.checkIn) : "—" },
                        { label: "Check-out", value: booking.checkOut ? formatDate(booking.checkOut) : "—" },
                        { label: "Guests", value: `${booking.guests || 1} guest${(booking.guests || 1) === 1 ? "" : "s"}` },
                        { label: "Payment", value: booking.paymentMethod === "bank" ? "Bank transfer" : booking.paymentMethod === "ussd" ? "USSD" : "Card" },
                      ].map((item) => (
                        <div key={item.label}>
                          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted">{item.label}</p>
                          <p className="mt-1 text-[11.5px] font-semibold text-ink">{item.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button href={`/confirmation/${booking.reference}`} size="sm" variant="secondary">View booking</Button>
                      {canCancel && booking.paymentStatus && booking.paymentStatus !== "paid" && (
                        <Button href={`/confirmation/${booking.reference}`} size="sm" icon="lock">Complete payment</Button>
                      )}
                      {canCancel && (
                        <>
                          <Button size="sm" variant="danger" onClick={() => setCancelRef(booking.reference)}>Cancel</Button>
                          <Link href={supportWhatsAppUrl(`Hi JosStay, I need help with booking ${booking.reference}.`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-2 py-2 text-[11.5px] font-semibold text-emerald-700">
                            <Icon name="whatsapp" className="h-4 w-4" /> Contact support
                          </Link>
                        </>
                      )}
                      {(booking.status === "completed" || booking.status === "cancelled") && booking.propertySlug && (
                        <Button size="sm" icon="refresh" onClick={() => router.push(`/property/${booking.propertySlug}`)}>Book again</Button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      {cancelRef && selected && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
          <button type="button" className="absolute inset-0 bg-ink/45 animate-fade-in" aria-label="Close cancellation dialog" onClick={() => !canceling && setCancelRef(null)} />
          <div className="relative w-full max-w-md rounded-t-2xl bg-white p-5 shadow-float animate-slide-up sm:rounded-2xl">
            <h3 className="font-display text-xl font-bold text-ink">Cancel this booking?</h3>
            <p className="mt-2 text-[13px] leading-relaxed text-muted">
              You&apos;re about to cancel <strong className="font-semibold text-ink">{selected.propertyName || "this booking"}</strong> ({selected.reference}).
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setCancelRef(null)} disabled={canceling}>Keep booking</Button>
              <Button variant="danger" onClick={confirmCancel} loading={canceling}>Cancel booking</Button>
            </div>
            <button type="button" onClick={() => setCancelRef(null)} disabled={canceling} className="mt-3 w-full text-center text-[11px] font-semibold text-muted disabled:opacity-50">Go back</button>
          </div>
        </div>
      )}
    </div>
  );
}
