"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/providers";
import { api, createIdempotencyKey } from "@/lib/api";
import { LoadingResults } from "@/components/shared/states";
import { SearchSelect } from "@/components/shared/SearchSelect";

const REQUEST_STATUS = {
  pending_review: { label: "Pending review", tone: "gold" },
  approved: { label: "Approved", tone: "purple" },
  processing: { label: "Processing", tone: "purple" },
  paid: { label: "Paid", tone: "verified" },
  rejected: { label: "Rejected", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  failed: { label: "Failed", tone: "danger" },
};

const EARNING_STATUS = {
  pending: { label: "Pending", tone: "gold" },
  available: { label: "Available", tone: "green" },
  reserved: { label: "Reserved", tone: "purple" },
  paid: { label: "Paid", tone: "verified" },
  reversed: { label: "Reversed", tone: "neutral" },
};

const fmtMoney = (amount, format) => (typeof format === "function" ? format(Number(amount || 0)) : `₦${Number(amount || 0).toLocaleString("en-NG")}`);
const fmtDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

function StatCard({ label, value, hint, icon, tone = "purple" }) {
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">{label}</p>
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${tone === "gold" ? "bg-gold-100 text-plum-700" : tone === "green" ? "bg-emerald-50 text-emerald-700" : "bg-plum-50 text-plum-700"}`}>
          <Icon name={icon} className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 font-display text-[20px] font-bold leading-tight text-ink">{value}</p>
      {hint ? <p className="mt-0.5 text-[10px] text-muted">{hint}</p> : null}
    </div>
  );
}

export function PayoutsPanel({ format, supportWhatsAppUrl }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [earnings, setEarnings] = useState([]);
  const [requests, setRequests] = useState([]);
  const [methods, setMethods] = useState([]);
  const [banks, setBanks] = useState([]);
  const [sampleData, setSampleData] = useState(false);

  const [bankForm, setBankForm] = useState({ bankCode: "", accountNumber: "" });
  const [savingBank, setSavingBank] = useState(false);
  const [requestAmount, setRequestAmount] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [requesting, setRequesting] = useState(false);
  const [cancellingId, setCancellingId] = useState("");

  const activeMethod = useMemo(
    () => methods.find((m) => m.status === "verified") || summary?.bankAccount || null,
    [methods, summary?.bankAccount],
  );

  const bankOptions = useMemo(
    () => banks.map((bank) => ({ value: String(bank.code), label: bank.name })),
    [banks],
  );

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [summaryRes, earningsRes, requestsRes, methodsRes, banksRes] = await Promise.all([
        api.get("/api/host/payouts/summary", { cache: "no-store" }),
        api.get("/api/host/payouts/earnings?limit=20", { cache: "no-store" }),
        api.get("/api/host/payouts/requests?limit=20", { cache: "no-store" }),
        api.get("/api/host/payout-methods", { cache: "no-store" }),
        api.get("/api/host/payout-methods/banks", { cache: "no-store" }).catch(() => ({ data: [] })),
      ]);
      setSummary(summaryRes?.data || null);
      setEarnings(Array.isArray(earningsRes?.data) ? earningsRes.data : []);
      setRequests(Array.isArray(requestsRes?.data) ? requestsRes.data : []);
      setMethods(Array.isArray(methodsRes?.data) ? methodsRes.data : []);
      setBanks(Array.isArray(banksRes?.data) ? banksRes.data : []);
      setSampleData(Boolean(summaryRes?.sampleData || earningsRes?.sampleData || requestsRes?.sampleData || methodsRes?.sampleData));
    } catch (error) {
      toast(error?.message || "Could not load payouts", "error");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const withdrawable = Number(summary?.withdrawable || 0);
  const minimum = Number(summary?.minimum || 10000);
  const openRequest = summary?.openRequest || requests.find((r) => ["pending_review", "approved", "processing"].includes(r.status));

  const saveBank = async (e) => {
    e.preventDefault();
    if (!bankForm.bankCode) return toast("Select your bank", "error");
    if (!/^\d{10}$/.test(bankForm.accountNumber)) return toast("Enter a 10-digit account number", "error");
    if (openRequest) return toast("Cancel or resolve your open payout request before changing bank details", "error");

    setSavingBank(true);
    try {
      const bankName = banks.find((b) => String(b.code) === String(bankForm.bankCode))?.name;
      await api.post("/api/host/payout-methods", {
        bankCode: bankForm.bankCode,
        accountNumber: bankForm.accountNumber,
        ...(bankName ? { bankName } : {}),
      });
      toast("Bank account verified and saved", "success");
      setBankForm({ bankCode: "", accountNumber: "" });
      await load({ silent: true });
    } catch (error) {
      toast(error?.message || "Could not save bank account", "error");
    } finally {
      setSavingBank(false);
    }
  };

  const submitRequest = async (e) => {
    e.preventDefault();
    const amount = Math.round(Number(requestAmount));
    if (!Number.isFinite(amount) || amount <= 0) return toast("Enter a valid payout amount", "error");
    if (amount < minimum) return toast(`Minimum payout is ${fmtMoney(minimum, format)}`, "error");
    if (amount > withdrawable) return toast("Amount exceeds your available balance", "error");
    if (!activeMethod) return toast("Add a verified bank account first", "error");
    if (openRequest) return toast("You already have an open payout request", "error");

    setRequesting(true);
    try {
      await api.post("/api/host/payouts/requests", {
        amount,
        ...(requestNote.trim() ? { note: requestNote.trim() } : {}),
      }, { idempotencyKey: createIdempotencyKey() });
      toast("Payout request submitted for review", "success");
      setRequestAmount("");
      setRequestNote("");
      await load({ silent: true });
    } catch (error) {
      toast(error?.message || "Could not submit payout request", "error");
    } finally {
      setRequesting(false);
    }
  };

  const cancelRequest = async (requestId) => {
    if (!requestId || !window.confirm("Cancel this payout request? Reserved earnings will become available again.")) return;
    setCancellingId(requestId);
    try {
      await api.post(`/api/host/payouts/requests/${requestId}/cancel`);
      toast("Payout request cancelled", "success");
      await load({ silent: true });
    } catch (error) {
      toast(error?.message || "Could not cancel payout request", "error");
    } finally {
      setCancellingId("");
    }
  };

  if (loading) return <div className="mt-5"><LoadingResults count={3} /></div>;

  return (
    <div className="mt-5 space-y-5">
      {sampleData ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-900">
          Showing sample payout data while live payout records are unavailable.
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Available" value={fmtMoney(withdrawable, format)} hint="Ready to request" icon="wallet" tone="green" />
        <StatCard label="Reserved" value={fmtMoney(summary?.reserved, format)} hint="In open requests" icon="clock" tone="gold" />
        <StatCard label="Pending earnings" value={fmtMoney(summary?.pendingEarnings, format)} hint="Waiting for hold period" icon="calendar" />
        <StatCard label="Paid out" value={fmtMoney(summary?.paidTotal, format)} hint="Settled to you" icon="checkCircle" tone="green" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-xl border border-line bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-[19px] font-bold tracking-tight text-ink">Request payout</h2>
              <p className="mt-1 text-xs text-muted">Minimum {fmtMoney(minimum, format)}. Commission is already deducted from available earnings.</p>
            </div>
            {openRequest ? <Badge tone={REQUEST_STATUS[openRequest.status]?.tone || "gold"}>{REQUEST_STATUS[openRequest.status]?.label || openRequest.status}</Badge> : null}
          </div>

          {openRequest ? (
            <div className="mt-4 rounded-lg border border-plum-100 bg-plum-50 px-4 py-3 text-sm text-plum-900">
              <p className="font-semibold">You have an open payout request</p>
              <p className="mt-1 text-[12px] text-plum-800">{openRequest.reference} · {fmtMoney(openRequest.amount, format)} · {REQUEST_STATUS[openRequest.status]?.label || openRequest.status}</p>
              {openRequest.status === "pending_review" ? (
                <Button size="sm" variant="secondary" className="mt-3" loading={cancellingId === openRequest.id} onClick={() => cancelRequest(openRequest.id)}>Cancel request</Button>
              ) : (
                <p className="mt-2 text-[11px] text-plum-700">This request is being processed. You can submit a new request after it is settled or rejected.</p>
              )}
            </div>
          ) : (
            <form onSubmit={submitRequest} className="mt-4 space-y-3">
              <label className="block">
                <span className="label">Amount (NGN)</span>
                <input
                  className="field"
                  inputMode="numeric"
                  value={requestAmount}
                  onChange={(e) => setRequestAmount(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder={`Minimum ${minimum.toLocaleString("en-NG")}`}
                />
                <p className="mt-1 text-[11px] text-muted">Available: {fmtMoney(withdrawable, format)}</p>
              </label>
              <label className="block">
                <span className="label">Note to admin (optional)</span>
                <textarea className="field min-h-[72px] resize-none" value={requestNote} onChange={(e) => setRequestNote(e.target.value)} maxLength={500} placeholder="Anything the admin should know" />
              </label>
              <Button type="submit" loading={requesting} disabled={!activeMethod || withdrawable < minimum}>Submit payout request</Button>
              {!activeMethod ? <p className="text-[11px] text-amber-700">Add and verify a bank account before requesting a payout.</p> : null}
            </form>
          )}
        </div>

        <div className="rounded-xl border border-line bg-white p-4 sm:p-5">
          <h2 className="font-display text-[19px] font-bold tracking-tight text-ink">Payout bank account</h2>
          <p className="mt-1 text-xs text-muted">Payouts are sent manually by admin after review. Your account name must match your bank records.</p>

          {activeMethod ? (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
              <p className="font-semibold text-emerald-900">{activeMethod.bankName}</p>
              <p className="text-[12px] text-emerald-800">{activeMethod.accountName}</p>
              <p className="mt-1 font-mono text-[12px] text-emerald-900">{activeMethod.accountNumberMasked}</p>
              <Badge tone="verified" className="mt-2">Verified</Badge>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">No verified bank account yet.</p>
          )}

          <form onSubmit={saveBank} className="mt-4 space-y-3 border-t border-line pt-4">
            <p className="text-xs font-semibold text-ink">{activeMethod ? "Replace bank account" : "Add bank account"}</p>
            <SearchSelect
              variant="form"
              icon="bank"
              label="Bank"
              panelTitle="Select bank"
              ariaLabel="Select bank"
              value={bankForm.bankCode}
              onChange={(bankCode) => setBankForm((prev) => ({ ...prev, bankCode }))}
              options={[{ value: "", label: "Select bank" }, ...bankOptions]}
            />
            <label className="block">
              <span className="label">Account number</span>
              <input
                className="field"
                inputMode="numeric"
                maxLength={10}
                value={bankForm.accountNumber}
                onChange={(e) => setBankForm((prev) => ({ ...prev, accountNumber: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                placeholder="10-digit account number"
              />
            </label>
            <Button type="submit" variant="secondary" loading={savingBank} disabled={Boolean(openRequest)}>
              {activeMethod ? "Verify and replace" : "Verify and save"}
            </Button>
            {openRequest ? <p className="text-[11px] text-muted">Bank changes are locked while a payout request is open.</p> : null}
          </form>
        </div>
      </div>

      <div className="rounded-xl border border-line bg-white p-4 sm:p-5">
        <h2 className="font-display text-[19px] font-bold tracking-tight text-ink">Payout requests</h2>
        <p className="mt-1 text-xs text-muted">Track review and settlement status. Paid requests include a transfer reference.</p>
        {requests.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No payout requests yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-wide text-muted">
                  <th className="pb-2 font-semibold">Reference</th>
                  <th className="pb-2 font-semibold">Amount</th>
                  <th className="pb-2 font-semibold">Status</th>
                  <th className="pb-2 font-semibold">Bank</th>
                  <th className="pb-2 font-semibold">Date</th>
                  <th className="pb-2 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => {
                  const status = REQUEST_STATUS[request.status] || { label: request.status, tone: "neutral" };
                  return (
                    <tr key={request.id || request.reference} className="border-b border-line/60 align-top last:border-0">
                      <td className="py-3">
                        <p className="font-mono text-[11px] font-semibold text-ink">{request.reference}</p>
                        {request.providerReference ? <p className="mt-0.5 text-[10px] text-muted">Transfer: {request.providerReference}</p> : null}
                        {request.reviewNote ? <p className="mt-1 text-[11px] text-muted">{request.reviewNote}</p> : null}
                      </td>
                      <td className="py-3 font-semibold text-ink">{fmtMoney(request.amount, format)}</td>
                      <td className="py-3"><Badge tone={status.tone}>{status.label}</Badge></td>
                      <td className="py-3 text-muted">
                        <p className="text-ink">{request.bank?.bankName || "—"}</p>
                        <p className="text-[11px]">{request.bank?.accountNumberMasked || ""}</p>
                      </td>
                      <td className="py-3 text-muted">{fmtDate(request.createdAt)}</td>
                      <td className="py-3 text-right">
                        {request.status === "pending_review" ? (
                          <Button size="sm" variant="secondary" loading={cancellingId === request.id} onClick={() => cancelRequest(request.id)}>Cancel</Button>
                        ) : (
                          <span className="text-[11px] text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-line bg-white p-4 sm:p-5">
        <h2 className="font-display text-[19px] font-bold tracking-tight text-ink">Earnings ledger</h2>
        <p className="mt-1 text-xs text-muted">Each paid booking becomes an earning after commission. Available earnings can be requested as payouts.</p>
        {earnings.length === 0 ? (
          <p className="mt-4 text-sm text-muted">No earnings yet. Paid bookings will appear here.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead>
                <tr className="border-b border-line text-[10px] uppercase tracking-wide text-muted">
                  <th className="pb-2 font-semibold">Booking</th>
                  <th className="pb-2 font-semibold">Gross</th>
                  <th className="pb-2 font-semibold">Commission</th>
                  <th className="pb-2 font-semibold">Net</th>
                  <th className="pb-2 font-semibold">Available</th>
                  <th className="pb-2 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {earnings.map((earning) => {
                  const status = EARNING_STATUS[earning.status] || { label: earning.status, tone: "neutral" };
                  const free = Math.max(0, Number(earning.net || 0) - Number(earning.reservedAmount || 0) - Number(earning.paidAmount || 0));
                  return (
                    <tr key={earning.id || earning.bookingReference} className="border-b border-line/60 last:border-0">
                      <td className="py-3">
                        <p className="font-mono text-[11px] font-semibold text-ink">{earning.bookingReference}</p>
                        <p className="text-[11px] text-muted">{fmtDate(earning.createdAt)}</p>
                      </td>
                      <td className="py-3 text-ink">{fmtMoney(earning.gross, format)}</td>
                      <td className="py-3 text-muted">−{fmtMoney(earning.commission, format)}</td>
                      <td className="py-3 font-semibold text-ink">{fmtMoney(earning.net, format)}</td>
                      <td className="py-3 text-muted">{fmtMoney(free, format)}</td>
                      <td className="py-3"><Badge tone={status.tone}>{status.label}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-line bg-white p-4">
        <h3 className="text-sm font-bold text-ink">Need a hand?</h3>
        <p className="mt-1 text-[11px] leading-relaxed text-muted">Questions about commission, payout timing, or a rejected request? Our team can help.</p>
        {supportWhatsAppUrl ? (
          <a href={supportWhatsAppUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 underline underline-offset-4">
            <Icon name="whatsapp" className="h-3.5 w-3.5" /> Chat with JosStay support
          </a>
        ) : null}
      </div>
    </div>
  );
}
