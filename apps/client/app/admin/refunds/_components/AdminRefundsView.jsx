"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useAuth, useToast } from "@/components/providers";
import { api } from "@/lib/api";
import { EmptyState, LoadingResults } from "@/components/shared/states";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { AdminNav } from "../../_components/AdminNav";

const QUEUES = [
  { id: "requests", label: "Guest requests" },
  { id: "flags", label: "Payment flags" },
];

const FLAG_STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "All" },
];

const REQUEST_STATUS_OPTIONS = [
  { value: "", label: "All requests" },
  { value: "pending_review", label: "Pending review" },
  { value: "approved", label: "Approved" },
  { value: "refunded", label: "Refunded" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

const REQUEST_STATUS_META = {
  pending_review: { label: "Pending review", tone: "amber" },
  approved: { label: "Approved", tone: "purple" },
  refunded: { label: "Refunded", tone: "green" },
  rejected: { label: "Rejected", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

const REASON_LABELS = {
  change_of_plans: "Change of plans",
  booking_cancelled: "Guest cancelled booking",
  duplicate_charge: "Duplicate charge",
  property_not_as_described: "Property not as described",
  host_cancelled: "Host cancelled",
  payment_issue: "Payment issue",
  other: "Other",
};

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
  const [queue, setQueue] = useState("requests");
  const [loadingFlags, setLoadingFlags] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [items, setItems] = useState([]);
  const [requests, setRequests] = useState([]);
  const [statusFilter, setStatusFilter] = useState("open");
  const [requestStatus, setRequestStatus] = useState("");
  const [notesByRef, setNotesByRef] = useState({});
  const [busyRef, setBusyRef] = useState("");
  const [requestForms, setRequestForms] = useState({});
  const [busyRequest, setBusyRequest] = useState("");

  const loadFlags = useCallback(async () => {
    setLoadingFlags(true);
    try {
      const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
      const res = await api.get(`/api/admin/payments/refunds${qs}`, { cache: "no-store" });
      setItems(Array.isArray(res?.data) ? res.data : []);
    } catch (error) {
      toast(error?.message || "Could not load refund review queue", "error");
      setItems([]);
    } finally {
      setLoadingFlags(false);
    }
  }, [statusFilter, toast]);

  const loadRequests = useCallback(async () => {
    setLoadingRequests(true);
    try {
      const qs = requestStatus ? `?status=${encodeURIComponent(requestStatus)}` : "";
      const res = await api.get(`/api/admin/refund-requests${qs}`, { cache: "no-store" });
      setRequests(Array.isArray(res?.data) ? res.data : []);
    } catch (error) {
      toast(error?.message || "Could not load guest refund requests", "error");
      setRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  }, [requestStatus, toast]);

  useEffect(() => {
    if (auth.isLoading) return;
    if (!auth.isAuthenticated) {
      router.push("/account");
      return;
    }
    if (auth.user?.role !== "admin") {
      setLoadingRequests(false);
      setLoadingFlags(false);
      return;
    }
    if (queue === "flags") loadFlags();
    else loadRequests();
  }, [
    auth.isLoading,
    auth.isAuthenticated,
    auth.user?.role,
    queue,
    loadFlags,
    loadRequests,
    router,
  ]);

  const resolve = async (paymentReference) => {
    setBusyRef(paymentReference);
    try {
      await api.patch(`/api/admin/payments/refunds/${encodeURIComponent(paymentReference)}/resolve`, {
        note: (notesByRef[paymentReference] || "").trim() || undefined,
      });
      toast("Marked as resolved", "success");
      await loadFlags();
    } catch (error) {
      toast(error?.message || "Could not mark refund as resolved", "error");
    } finally {
      setBusyRef("");
    }
  };

  const formFor = (id) => requestForms[id] || { note: "", refundReference: "" };
  const updateForm = (id, patch) =>
    setRequestForms((prev) => ({ ...prev, [id]: { ...formFor(id), ...patch } }));

  const requestAction = async (id, action) => {
    const form = formFor(id);
    const body = {};
    if (action === "reject") {
      if (!form.note.trim()) {
        toast("Add a note explaining the rejection", "error");
        return;
      }
      body.note = form.note.trim();
    } else if (action === "mark-refunded") {
      if (!form.refundReference.trim()) {
        toast("Add the Paystack refund reference", "error");
        return;
      }
      body.refundReference = form.refundReference.trim();
      if (form.note.trim()) body.note = form.note.trim();
    } else if (form.note.trim()) {
      body.note = form.note.trim();
    }

    setBusyRequest(id);
    try {
      await api.patch(`/api/admin/refund-requests/${encodeURIComponent(id)}/${action}`, body);
      toast("Refund request updated", "success");
      setRequestForms((prev) => ({ ...prev, [id]: { note: "", refundReference: "" } }));
      await loadRequests();
    } catch (error) {
      toast(error?.message || "Could not update refund request", "error");
    } finally {
      setBusyRequest("");
    }
  };

  const isAdmin = auth.user?.role === "admin";
  const loading = queue === "flags" ? loadingFlags : loadingRequests;

  if (auth.isLoading || (loading && (queue === "flags" ? items.length === 0 : requests.length === 0))) {
    return <div className="container-page py-10"><LoadingResults count={3} /></div>;
  }

  if (!auth.isAuthenticated) return null;

  if (!isAdmin) {
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

  const openFlags = items.filter((i) => i.requiresRefund && !i.refundResolved).length;
  const pendingRequests = requests.filter((r) => r.status === "pending_review" || r.status === "approved").length;

  return (
    <div className="container-page pb-16 pt-6 sm:pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">Admin</span>
          <h1 className="mt-3 font-display text-[32px] font-bold leading-none tracking-tight text-ink sm:text-[40px]">Refunds</h1>
          <p className="mt-2 text-sm text-muted">Guest refund requests and payment flags. JosStay does not automatically issue Paystack refunds.</p>
          <AdminNav />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-[170px] max-w-full">
            {queue === "flags" ? (
              <SearchSelect
                variant="form"
                icon="sliders"
                label="Refund status"
                panelTitle="Filter refund reviews"
                ariaLabel="Filter refund review status"
                value={statusFilter}
                onChange={setStatusFilter}
                options={FLAG_STATUS_OPTIONS}
              />
            ) : (
              <SearchSelect
                variant="form"
                icon="sliders"
                label="Request status"
                panelTitle="Filter guest requests"
                ariaLabel="Filter guest refund request status"
                value={requestStatus}
                onChange={setRequestStatus}
                options={REQUEST_STATUS_OPTIONS}
              />
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={queue === "flags" ? loadFlags : loadRequests}
            loading={loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      <div className="mt-5 inline-flex rounded-lg border border-line bg-white p-1">
        {QUEUES.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setQueue(tab.id)}
            className={`rounded-md px-3.5 py-1.5 text-[12px] font-semibold transition ${
              queue === tab.id ? "bg-ink text-white" : "text-muted hover:text-ink"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {queue === "flags" ? (
        <>
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
            <strong>{statusFilter === "open" ? openFlags : items.length}</strong> {statusFilter === "open" ? "open payment flag(s)" : "payment flag(s) shown"}. Verify each case in the Paystack dashboard before issuing a manual refund.
          </div>

          <div className="mt-6 space-y-4">
            {items.length === 0 ? (
              <EmptyState icon="shield" title="No payment flags" description="There are no payments matching this filter." />
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
        </>
      ) : (
        <>
          <div className="mt-5 rounded-xl border border-plum-100 bg-plum-50 px-4 py-3 text-[13px] text-plum-900">
            <strong>{pendingRequests}</strong> request(s) awaiting review or settlement. Approve first, refund the full charged amount in Paystack, then record the refund reference here.
          </div>

          <div className="mt-6 space-y-4">
            {requests.length === 0 ? (
              <EmptyState icon="wallet" title="No guest refund requests" description="There are no refund requests matching this filter." />
            ) : requests.map((request) => {
              const meta = REQUEST_STATUS_META[request.status] || { label: request.status, tone: "neutral" };
              const form = formFor(request.id);
              const busy = busyRequest === request.id;
              return (
                <article key={request.id} className="rounded-xl border border-line bg-white p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-bold text-ink">{request.booking?.propertyName || "Booking"}</h2>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                        <Badge tone="neutral">{REASON_LABELS[request.reason] || reasonLabel(request.reason)}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted">
                        {formatMoney(request.amount, request.currency)} · Request: <span className="font-mono">{request.reference}</span>
                      </p>
                      <p className="mt-1 text-[11px] text-muted">
                        Booking: <span className="font-medium text-ink">{request.bookingReference}</span>
                        {request.booking?.guestName ? ` · ${request.booking.guestName}` : ""}
                        {request.booking?.guestEmail ? ` · ${request.booking.guestEmail}` : ""}
                      </p>
                      <p className="mt-1 text-[11px] text-muted">
                        {request.booking?.roomName ? `${request.booking.roomName} · ` : ""}
                        {request.booking?.checkIn || "—"} to {request.booking?.checkOut || "—"}
                        {request.booking?.status ? ` · Booking ${request.booking.status}` : ""}
                      </p>
                      <p className="mt-1 text-[11px] text-muted">
                        Paystack ref: <span className="font-mono">{request.paymentReference || request.booking?.paymentReference || "—"}</span>
                        {` · Stay ${formatMoney(request.stayAmount, request.currency)} + fee ${formatMoney(request.paymentFee, request.currency)}`}
                      </p>
                      {request.details ? (
                        <p className="mt-2 rounded-lg bg-canvas px-3 py-2 text-[12px] leading-relaxed text-ink">{request.details}</p>
                      ) : null}
                    </div>
                    <div className="text-right text-[11px] text-muted">
                      <p>Requested: {formatDate(request.createdAt)}</p>
                      {request.reviewedAt ? <p>Reviewed: {formatDate(request.reviewedAt)}</p> : null}
                      {request.refundedAt ? <p>Refunded: {formatDate(request.refundedAt)}</p> : null}
                      {request.refundReference ? (
                        <p>Refund ref: <span className="font-mono">{request.refundReference}</span></p>
                      ) : null}
                    </div>
                  </div>

                  {request.adminNote ? (
                    <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-[12px] text-ink">
                      <strong className="font-semibold">Admin note:</strong> {request.adminNote}
                    </p>
                  ) : null}

                  {["pending_review", "approved"].includes(request.status) ? (
                    <div className="mt-4 space-y-2">
                      <label className="block">
                        <span className="label">
                          {request.status === "approved" ? "Refund reference" : "Review note (optional for approval)"}
                        </span>
                        {request.status === "approved" ? (
                          <input
                            className="field"
                            placeholder="Paystack refund reference or transaction id"
                            value={form.refundReference}
                            onChange={(e) => updateForm(request.id, { refundReference: e.target.value })}
                          />
                        ) : null}
                      </label>
                      <label className="block">
                        <span className="label">{request.status === "approved" ? "Settlement note" : "Note"}</span>
                        <textarea
                          className="field min-h-[70px]"
                          placeholder={request.status === "approved"
                            ? "e.g. Refunded full ₦ amount in Paystack dashboard on 2026-11-25."
                            : "Explain the decision. Required when rejecting."}
                          value={form.note}
                          onChange={(e) => updateForm(request.id, { note: e.target.value })}
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {request.status === "pending_review" ? (
                          <Button size="sm" onClick={() => requestAction(request.id, "approve")} loading={busy}>
                            Approve
                          </Button>
                        ) : (
                          <Button size="sm" onClick={() => requestAction(request.id, "mark-refunded")} loading={busy}>
                            Mark refunded
                          </Button>
                        )}
                        <Button size="sm" variant="danger" onClick={() => requestAction(request.id, "reject")} loading={busy}>
                          Reject
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
                  ) : null}
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
