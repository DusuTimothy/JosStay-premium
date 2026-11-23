"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAuth, useToast } from "@/components/providers";
import { api } from "@/lib/api";
import { EmptyState, LoadingResults } from "@/components/shared/states";
import { AdminNav } from "../../_components/AdminNav";

const formatMoney = (amount, currency = "NGN") => {
  const value = Number(amount || 0);
  if (currency === "NGN") return `₦${value.toLocaleString("en-NG")}`;
  return `${currency} ${value.toLocaleString()}`;
};

const formatDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

const reasonLabel = (reason) => {
  const map = {
    duplicate_successful_charge: "Duplicate successful charge",
    stay_no_longer_available: "Stay no longer available",
    amount_mismatch: "Amount mismatch",
    booking_cancelled: "Booking cancelled",
    booking_abandoned: "Booking abandoned",
  };
  return map[reason] || (reason ? String(reason).replace(/_/g, " ") : "Needs review");
};

export function AdminRefundsView() {
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState("open");
  const [notesByRef, setNotesByRef] = useState({});
  const [busyRef, setBusyRef] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
      const res = await api.get(`/api/admin/payments/refunds${qs}`, { cache: "no-store" });
      setItems(Array.isArray(res?.data) ? res.data : []);
    } catch (error) {
      toast(error?.message || "Could not load refund review queue", "error");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    if (auth.isLoading) return;
    if (!auth.isAuthenticated) {
      router.push("/account");
      return;
    }
    if (auth.user?.role !== "admin") {
      setLoading(false);
      return;
    }
    load();
  }, [auth.isLoading, auth.isAuthenticated, auth.user?.role, load, router]);

  const resolve = async (paymentReference) => {
    setBusyRef(paymentReference);
    try {
      await api.patch(`/api/admin/payments/refunds/${encodeURIComponent(paymentReference)}/resolve`, {
        note: (notesByRef[paymentReference] || "").trim() || undefined,
      });
      toast("Marked as resolved", "success");
      await load();
    } catch (error) {
      toast(error?.message || "Could not mark refund as resolved", "error");
    } finally {
      setBusyRef("");
    }
  };

  if (auth.isLoading || loading) {
    return <div className="container-page py-10"><LoadingResults count={3} /></div>;
  }

  if (!auth.isAuthenticated) return null;

  if (auth.user?.role !== "admin") {
    return (
      <div className="container-page py-16">
        <EmptyState
          icon="shield"
          title="Admin access required"
          description="This page is only available to admin accounts."
          actionLabel="Go home"
          onAction={() => router.push("/")}
        />
      </div>
    );
  }

  const openCount = items.filter((i) => i.requiresRefund && !i.refundResolved).length;

  return (
    <div className="container-page pb-16 pt-6 sm:pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">Admin</span>
          <h1 className="mt-3 font-display text-[32px] font-bold leading-none tracking-tight text-ink sm:text-[40px]">Refund review</h1>
          <p className="mt-2 text-sm text-muted">Payments flagged for manual refund review. JosStay does not automatically issue Paystack refunds.</p>
          <AdminNav />
        </div>
        <div className="flex items-center gap-2">
          <select
            className="field !h-10 !w-auto !py-0 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter refund review status"
          >
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
            <option value="all">All</option>
          </select>
          <Button variant="secondary" size="sm" onClick={load}>Refresh</Button>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
        <strong>{statusFilter === "open" ? openCount : items.length}</strong> {statusFilter === "open" ? "open refund review item(s)" : "item(s) shown"}. Verify each case in the Paystack dashboard before issuing a manual refund.
      </div>

      <div className="mt-6 space-y-4">
        {items.length === 0 ? (
          <EmptyState icon="shield" title="No refund review items" description="There are no payments matching this filter." />
        ) : items.map((item) => {
          const resolved = item.refundResolved === true;
          return (
            <article key={item.paymentReference} className="rounded-xl border border-line bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold text-ink">{item.booking?.propertyName || "Booking payment"}</h2>
                    <Badge tone={resolved ? "green" : "amber"}>{resolved ? "Resolved" : "Needs refund review"}</Badge>
                    <Badge tone="neutral">{reasonLabel(item.refundReason)}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {formatMoney(item.amount, item.currency)} · Paystack ref: <span className="font-mono">{item.paymentReference}</span>
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    Booking: <span className="font-medium text-ink">{item.bookingReference || "—"}</span>
                    {item.booking?.guestName ? ` · ${item.booking.guestName}` : ""}
                    {item.booking?.guestEmail ? ` · ${item.booking.guestEmail}` : ""}
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    {item.booking?.roomName ? `${item.booking.roomName} · ` : ""}
                    {item.booking?.checkIn || "—"} to {item.booking?.checkOut || "—"}
                    {item.booking?.status ? ` · Booking ${item.booking.status}` : ""}
                    {item.booking?.paymentStatus ? ` / ${item.booking.paymentStatus}` : ""}
                  </p>
                </div>
                <div className="text-right text-[11px] text-muted">
                  <p>Paid: {formatDate(item.paidAt)}</p>
                  <p>Created: {formatDate(item.createdAt)}</p>
                  <p>Payment: {item.paymentStatus || "—"}{item.channel ? ` · ${item.channel}` : ""}</p>
                </div>
              </div>

              {resolved ? (
                <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-3 text-xs text-emerald-900">
                  <p><strong>Resolved:</strong> {formatDate(item.refundResolvedAt)}</p>
                  {item.refundResolver?.name || item.refundResolver?.email ? (
                    <p className="mt-1"><strong>By:</strong> {item.refundResolver.name || item.refundResolver.email}</p>
                  ) : null}
                  {item.refundResolutionNote ? <p className="mt-1">{item.refundResolutionNote}</p> : null}
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  <label className="block">
                    <span className="label">Resolution note</span>
                    <textarea
                      className="field min-h-[76px]"
                      placeholder="e.g. Refunded in Paystack dashboard on 2026-11-23. Reference: ..."
                      value={notesByRef[item.paymentReference] || ""}
                      onChange={(e) => setNotesByRef((prev) => ({ ...prev, [item.paymentReference]: e.target.value }))}
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      onClick={() => resolve(item.paymentReference)}
                      loading={busyRef === item.paymentReference}
                    >
                      Mark resolved
                    </Button>
                    <a
                      href="https://dashboard.paystack.com/#/transactions"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-9 items-center rounded-lg border border-line px-3.5 text-[13px] font-semibold text-ink hover:border-plum-300 hover:text-plum-800"
                    >
                      Open Paystack dashboard
                    </a>
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
