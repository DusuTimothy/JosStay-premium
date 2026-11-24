"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useAuth, useToast } from "@/components/providers";
import { api } from "@/lib/api";
import { EmptyState, LoadingResults } from "@/components/shared/states";
import { SearchSelect } from "@/components/shared/SearchSelect";
import { AdminNav } from "../../_components/AdminNav";

const STATUS_OPTIONS = [
  { value: "pending_review", label: "Pending review" },
  { value: "approved", label: "Approved" },
  { value: "processing", label: "Processing" },
  { value: "paid", label: "Paid" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
  { value: "failed", label: "Failed" },
  { value: "", label: "All requests" },
];

const STATUS_META = {
  pending_review: { label: "Pending review", tone: "gold" },
  approved: { label: "Approved", tone: "purple" },
  processing: { label: "Processing", tone: "purple" },
  paid: { label: "Paid", tone: "verified" },
  rejected: { label: "Rejected", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  failed: { label: "Failed", tone: "danger" },
};

const fmtMoney = (amount) => `₦${Number(amount || 0).toLocaleString("en-NG")}`;
const fmtDate = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
};

export function AdminPayoutsView() {
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState("pending_review");
  const [notesById, setNotesById] = useState({});
  const [transferRefById, setTransferRefById] = useState({});
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
      const res = await api.get(`/api/admin/payouts/requests${qs}`, { cache: "no-store" });
      setItems(Array.isArray(res?.data) ? res.data : []);
    } catch (error) {
      toast(error?.message || "Could not load payout requests", "error");
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

  const pendingCount = useMemo(
    () => items.filter((item) => item.status === "pending_review").length,
    [items],
  );

  const act = async (item, action) => {
    let body = {};
    if (action === "reject") {
      const note = (notesById[item.id] || "").trim();
      if (!note) {
        toast("Enter a reason before rejecting", "error");
        return;
      }
      body = { note };
    } else if (action === "mark-paid") {
      const providerReference = (transferRefById[item.id] || "").trim();
      if (!providerReference) {
        toast("Enter the Paystack transfer reference", "error");
        return;
      }
      body = { providerReference, note: (notesById[item.id] || "").trim() || undefined };
    } else {
      body = { note: (notesById[item.id] || "").trim() || undefined };
    }

    setBusyId(`${item.id}:${action}`);
    try {
      await api.patch(`/api/admin/payouts/requests/${item.id}/${action}`, body);
      toast(action === "approve" ? "Payout approved" : action === "reject" ? "Payout rejected" : "Payout marked as paid", "success");
      setNotesById((prev) => ({ ...prev, [item.id]: "" }));
      setTransferRefById((prev) => ({ ...prev, [item.id]: "" }));
      await load();
    } catch (error) {
      toast(error?.message || "Payout action failed", "error");
    } finally {
      setBusyId("");
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

  return (
    <div className="container-page pb-16 pt-6 sm:pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">Admin</span>
          <h1 className="mt-3 font-display text-[32px] font-bold leading-none tracking-tight text-ink sm:text-[40px]">Payout review</h1>
          <p className="mt-2 text-sm text-muted">Review host payout requests against available earnings, then record manual settlement.</p>
          <AdminNav />
        </div>
        <div className="flex items-center gap-2">
          <div className="w-[200px] max-w-full">
            <SearchSelect
              variant="form"
              icon="sliders"
              label="Status"
              panelTitle="Filter by status"
              ariaLabel="Filter payout requests by status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={STATUS_OPTIONS}
            />
          </div>
          <Button variant="secondary" size="sm" onClick={load}>Refresh</Button>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
        <strong>{statusFilter === "pending_review" ? `${pendingCount} pending` : `${items.length} shown`}</strong>. Phase 1 is manual: approve requests here, make the transfer in Paystack, then record the transfer reference. No automatic transfers are made.
      </div>

      <div className="mt-6 space-y-4">
        {items.length === 0 ? (
          <EmptyState icon="wallet" title="No payout requests" description="There are no requests matching this status." />
        ) : items.map((item) => {
          const status = STATUS_META[item.status] || { label: item.status, tone: "neutral" };
          const earnings = Array.isArray(item.earnings) ? item.earnings : [];
          const canApprove = item.status === "pending_review";
          const canSettle = ["approved", "processing"].includes(item.status);
          return (
            <article key={item.id || item.reference} className="rounded-xl border border-line bg-white p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold text-ink">{fmtMoney(item.amount)}</h2>
                    <Badge tone={status.tone}>{status.label}</Badge>
                    <span className="font-mono text-[11px] text-muted">{item.reference}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    Host: <span className="font-medium text-ink">{item.host?.name || "Host"}</span>
                    {item.host?.email ? ` · ${item.host.email}` : ""}
                  </p>
                  <p className="mt-1 text-[11px] text-muted">
                    Bank: <span className="font-medium text-ink">{item.bank?.bankName || "—"}</span>
                    {item.bank?.accountName ? ` · ${item.bank.accountName}` : ""}
                    {item.bank?.accountNumberMasked ? ` · ${item.bank.accountNumberMasked}` : ""}
                  </p>
                  {item.hostNote ? <p className="mt-2 rounded-lg bg-canvas px-3 py-2 text-xs text-muted"><strong>Host note:</strong> {item.hostNote}</p> : null}
                </div>
                <div className="text-right text-[11px] text-muted">
                  <p>Requested: {fmtDate(item.createdAt)}</p>
                  {item.reviewedAt ? <p>Reviewed: {fmtDate(item.reviewedAt)}</p> : null}
                  {item.settledAt ? <p>Settled: {fmtDate(item.settledAt)}</p> : null}
                  {item.providerReference ? <p className="mt-1 font-mono text-ink">{item.providerReference}</p> : null}
                </div>
              </div>

              <div className="mt-4 rounded-lg border border-line bg-canvas px-3 py-2">
                <p className="text-[11px] font-semibold text-ink">Funded by {earnings.length} earning{earnings.length === 1 ? "" : "s"}</p>
                <div className="mt-2 space-y-1.5">
                  {earnings.length ? earnings.map((earning, idx) => (
                    <div key={`${item.id}-earning-${idx}`} className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                      <span className="font-mono text-muted">{earning.bookingReference}</span>
                      <span className="text-muted">Gross {fmtMoney(earning.gross)} · commission {fmtMoney(earning.commission)}</span>
                      <span className="font-semibold text-ink">Payout {fmtMoney(earning.amount)}</span>
                    </div>
                  )) : (
                    <p className="text-[11px] text-muted">Earning breakdown unavailable.</p>
                  )}
                </div>
              </div>

              {item.reviewNote ? <p className="mt-3 text-xs text-plum-700"><strong>Review note:</strong> {item.reviewNote}</p> : null}
              {item.settlementNote ? <p className="mt-1 text-xs text-emerald-700"><strong>Settlement note:</strong> {item.settlementNote}</p> : null}

              {canApprove || canSettle ? (
                <div className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="label">{canSettle ? "Settlement note (optional)" : "Review note (optional)"}</span>
                      <textarea
                        rows={2}
                        className="field resize-none"
                        value={notesById[item.id] || ""}
                        onChange={(e) => setNotesById((prev) => ({ ...prev, [item.id]: e.target.value }))}
                        maxLength={500}
                        placeholder={canSettle ? "e.g. Paid manually after Paystack check" : "Add a note for the audit trail"}
                      />
                    </label>
                    {canSettle ? (
                      <label className="block">
                        <span className="label">Paystack transfer reference</span>
                        <input
                          className="field"
                          value={transferRefById[item.id] || ""}
                          onChange={(e) => setTransferRefById((prev) => ({ ...prev, [item.id]: e.target.value }))}
                          placeholder="e.g. TRF-123456789"
                        />
                      </label>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    {canApprove ? (
                      <>
                        <Button size="sm" variant="secondary" loading={busyId === `${item.id}:reject`} disabled={Boolean(busyId)} onClick={() => act(item, "reject")}>Reject</Button>
                        <Button size="sm" icon="check" loading={busyId === `${item.id}:approve`} disabled={Boolean(busyId)} onClick={() => act(item, "approve")}>Approve</Button>
                      </>
                    ) : null}
                    {canSettle ? (
                      <Button size="sm" variant="plum" icon="checkCircle" loading={busyId === `${item.id}:mark-paid`} disabled={Boolean(busyId)} onClick={() => act(item, "mark-paid")}>Mark paid</Button>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
