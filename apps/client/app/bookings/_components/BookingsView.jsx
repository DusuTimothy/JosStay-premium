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
import { api, createIdempotencyKey } from "@/lib/api";
import { EmptyState, ErrorState, SkeletonCard } from "@/components/shared/states";
import { SearchSelect } from "@/components/shared/SearchSelect";

const TABS = [
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
  { id: "cancelled", label: "Cancelled" },
];

const REFUND_REASON_OPTIONS = [
  { value: "change_of_plans", label: "Change of plans" },
  { value: "booking_cancelled", label: "I cancelled the booking" },
  { value: "duplicate_charge", label: "I was charged twice" },
  { value: "property_not_as_described", label: "Property was not as described" },
  { value: "host_cancelled", label: "Host cancelled" },
  { value: "payment_issue", label: "Payment issue" },
  { value: "other", label: "Other reason" },
];

const REFUND_STATUS = {
  pending_review: { label: "Refund requested", tone: "gold" },
  approved: { label: "Refund approved", tone: "purple" },
  refunded: { label: "Refunded", tone: "green" },
  rejected: { label: "Refund declined", tone: "danger" },
  cancelled: { label: "Refund request cancelled", tone: "neutral" },
};

const refundStatus = (booking) => REFUND_STATUS[booking?.refundRequest?.status] || null;
const refundAmountFor = (booking) => Math.max(0, Number(booking?.total || 0) + Number(booking?.paymentFee || 0));
const canRequestRefund = (booking) =>
  booking?.paymentStatus === "paid" &&
  refundAmountFor(booking) > 0 &&
  !["pending_review", "approved", "refunded"].includes(booking?.refundRequest?.status);

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
  const [refundRef, setRefundRef] = useState(null);
  const [refundForm, setRefundForm] = useState({ reason: "change_of_plans", details: "" });
  const [requestingRefund, setRequestingRefund] = useState(false);
  const [cancelingRefund, setCancelingRefund] = useState(false);

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
  const refundSelected = bookings.find((b) => b.reference === refundRef) || null;

  const openRefund = (booking) => {
    setRefundRef(booking.reference);
    setRefundForm({ reason: "change_of_plans", details: "" });
  };

  const closeRefund = () => {
    if (requestingRefund) return;
    setRefundRef(null);
    setRefundForm({ reason: "change_of_plans", details: "" });
  };

  const submitRefund = async (e) => {
    e.preventDefault();
    if (!refundSelected) return;
    setRequestingRefund(true);
    try {
      await api.post(
        `/api/bookings/${encodeURIComponent(refundSelected.reference)}/refund-request`,
        {
          reason: refundForm.reason,
          ...(refundForm.details.trim() ? { details: refundForm.details.trim() } : {}),
        },
        { idempotencyKey: createIdempotencyKey() },
      );
      toast("Refund request submitted for review", "success");
      setRefundRef(null);
      setRefundForm({ reason: "change_of_plans", details: "" });
      await refreshBookings();
    } catch (error) {
      toast(error?.message || "Could not submit refund request", "error");
    } finally {
      setRequestingRefund(false);
    }
  };

  const cancelRefund = async (booking) => {
    if (!booking || cancelingRefund) return;
    if (!window.confirm("Cancel this refund request?")) return;
    setCancelingRefund(true);
    try {
      await api.delete(`/api/bookings/${encodeURIComponent(booking.reference)}/refund-request`);
      toast("Refund request cancelled", "success");
      await refreshBookings();
    } catch (error) {
      toast(error?.message || "Could not cancel refund request", "error");
    } finally {
      setCancelingRefund(false);
    }
  };

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
            const currentRefund = refundStatus(booking);
            const showRefundAction = canRequestRefund(booking);
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

                    {currentRefund ? (
                      <div className={`mt-3 rounded-lg border px-3 py-2.5 text-[11px] ${
                        currentRefund.tone === "green"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                          : currentRefund.tone === "danger"
                            ? "border-red-200 bg-red-50 text-red-900"
                            : currentRefund.tone === "purple"
                              ? "border-plum-100 bg-plum-50 text-plum-900"
                              : "border-amber-200 bg-amber-50 text-amber-900"
                      }`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="font-semibold">
                              {currentRefund.label}
                              {booking.refundRequest?.reference ? ` · ${booking.refundRequest.reference}` : ""}
                            </p>
                            <p className="mt-0.5 opacity-80">
                              {format(booking.refundRequest?.amount || refundAmountFor(booking))} · Submitted {booking.refundRequest?.createdAt ? formatDate(booking.refundRequest.createdAt) : "recently"}
                            </p>
                          </div>
                          {booking.refundRequest?.status === "pending_review" ? (
                            <Button size="sm" variant="secondary" loading={cancelingRefund} onClick={() => cancelRefund(booking)}>Cancel request</Button>
                          ) : null}
                        </div>
                        {booking.refundRequest?.status === "rejected" && booking.refundRequest?.adminNote ? (
                          <p className="mt-1.5 opacity-90">{booking.refundRequest.adminNote}</p>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Button href={`/confirmation/${booking.reference}`} size="sm" variant="secondary">View booking</Button>
                      {canCancel && booking.paymentStatus && booking.paymentStatus !== "paid" && (
                        <Button href={`/confirmation/${booking.reference}`} size="sm" icon="lock">Complete payment</Button>
                      )}
                      {canCancel && (
                        <Button size="sm" variant="danger" onClick={() => setCancelRef(booking.reference)}>Cancel</Button>
                      )}
                      {showRefundAction ? (
                        <Button size="sm" variant="secondary" icon="wallet" onClick={() => openRefund(booking)}>Request refund</Button>
                      ) : null}
                      {(canCancel || booking.paymentStatus === "paid") && (
                        <Link href={supportWhatsAppUrl(`Hi JosStay, I need help with booking ${booking.reference}.`)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 px-2 py-2 text-[11.5px] font-semibold text-emerald-700">
                          <Icon name="whatsapp" className="h-4 w-4" /> Contact support
                        </Link>
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

      {refundRef && refundSelected && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6">
          <button type="button" className="absolute inset-0 bg-ink/45 animate-fade-in" aria-label="Close refund dialog" onClick={closeRefund} />
          <form onSubmit={submitRefund} className="relative w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-float animate-slide-up sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="eyebrow">Refund request</span>
                <h3 className="mt-2 font-display text-xl font-bold text-ink">Request a refund</h3>
              </div>
              <button type="button" className="rounded-full p-2 text-muted hover:bg-canvas hover:text-ink" onClick={closeRefund} disabled={requestingRefund} aria-label="Close refund request">
                <Icon name="x" className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 rounded-lg border border-line bg-canvas px-3.5 py-3 text-[12px]">
              <p className="font-semibold text-ink">{refundSelected.propertyName || "Your stay"} · {refundSelected.reference}</p>
              <p className="mt-1 text-muted">{refundSelected.checkIn ? formatDate(refundSelected.checkIn) : "—"} to {refundSelected.checkOut ? formatDate(refundSelected.checkOut) : "—"}</p>
              <p className="mt-2 font-semibold text-ink">Refund amount: {format(refundAmountFor(refundSelected))}</p>
              <p className="mt-1 text-[11px] text-muted">This is the full amount charged, including the payment fee.</p>
            </div>

            <div className="mt-4">
              <SearchSelect
                variant="form"
                icon="wallet"
                label="Reason"
                panelTitle="Select a refund reason"
                ariaLabel="Select a refund reason"
                value={refundForm.reason}
                onChange={(reason) => setRefundForm((prev) => ({ ...prev, reason }))}
                options={REFUND_REASON_OPTIONS}
              />
            </div>

            <label className="mt-3 block">
              <span className="label">Tell us what happened (optional)</span>
              <textarea
                className="field min-h-[92px] resize-none"
                value={refundForm.details}
                onChange={(e) => setRefundForm((prev) => ({ ...prev, details: e.target.value }))}
                maxLength={1000}
                placeholder="Add anything that will help the team review your request."
              />
            </label>

            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-900">
              This sends a request to the JosStay team. Refunds are reviewed and processed manually through Paystack; no money moves automatically.
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button type="button" variant="secondary" onClick={closeRefund} disabled={requestingRefund}>Close</Button>
              <Button type="submit" loading={requestingRefund}>Submit request</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
