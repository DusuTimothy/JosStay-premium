"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useAuth, useToast } from "@/components/providers";
import { api } from "@/lib/api";
import { EmptyState, LoadingResults } from "@/components/shared/states";

const statusTone = (status) => {
  if (status === "verified" || status === "Live") return "verified";
  if (status === "rejected" || status === "Rejected" || status === "suspended" || status === "Suspended") return "neutral";
  return "gold";
};

export function AdminReviewsView() {
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [statusFilter, setStatusFilter] = useState("pending_review");
  const [notesById, setNotesById] = useState({});
  const [busyId, setBusyId] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = statusFilter ? `?status=${encodeURIComponent(statusFilter)}` : "";
      const res = await api.get(`/api/admin/listings/reviews${qs}`, { cache: "no-store" });
      setItems(Array.isArray(res?.data) ? res.data : []);
    } catch (error) {
      toast(error?.message || "Could not load review queue", "error");
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

  const counts = useMemo(() => {
    const all = items.length;
    return { all };
  }, [items]);

  const act = async (id, action) => {
    setBusyId(`${id}:${action}`);
    try {
      await api.patch(`/api/admin/listings/${id}/review`, {
        action,
        notes: (notesById[id] || "").trim() || undefined,
      });
      toast(action === "approve" ? "Listing approved" : action === "reject" ? "Listing rejected" : "Listing suspended", "success");
      await load();
    } catch (error) {
      toast(error?.message || "Review action failed", "error");
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
          <h1 className="mt-3 font-display text-[32px] font-bold leading-none tracking-tight text-ink sm:text-[40px]">Listing reviews</h1>
          <p className="mt-2 text-sm text-muted">Review host submissions, verify documents/photos, and approve or reject listings.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className="field !h-10 !w-auto !py-0 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="pending_review">Pending review</option>
            <option value="rejected">Rejected</option>
            <option value="verified">Verified</option>
            <option value="suspended">Suspended</option>
            <option value="draft">Draft</option>
            <option value="">All statuses</option>
          </select>
          <Button variant="secondary" size="sm" onClick={load}>Refresh</Button>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {items.length === 0 ? (
          <EmptyState icon="home" title="No listings found" description="There are no listings matching this filter." />
        ) : items.map((item) => (
          <article key={item.id} className="rounded-xl border border-line bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-base font-bold text-ink">{item.name}</h2>
                  <Badge tone={statusTone(item.verificationStatus)}>{item.status || item.verificationStatus}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted">
                  {item.type} · {item.area} · {item.photoCount || 0} photos · ₦{Number(item.price || 0).toLocaleString()}
                </p>
                <p className="mt-1 text-[11px] text-muted">
                  Host: <span className="font-medium text-ink">{item.host?.name || "Host"}</span>
                  {item.host?.email ? ` · ${item.host.email}` : ""}
                  {item.host?.phone ? ` · ${item.host.phone}` : ""}
                </p>
                {item.description ? <p className="mt-2 text-sm text-muted">{item.description}</p> : null}
                {item.verificationNotes ? (
                  <p className="mt-2 rounded-lg bg-plum-50 px-3 py-2 text-xs text-plum-700"><strong>Notes:</strong> {item.verificationNotes}</p>
                ) : null}
              </div>
              <div className="text-right text-[11px] text-muted">
                <p>Submitted: {item.submittedForVerificationAt ? new Date(item.submittedForVerificationAt).toLocaleString() : "—"}</p>
                <p>Updated: {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "—"}</p>
              </div>
            </div>

            {Array.isArray(item.images) && item.images.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {item.images.slice(0, 8).map((url, idx) => (
                  <a key={`${item.id}-img-${idx}`} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-line bg-canvas">
                    <img src={url} alt={`${item.name} photo ${idx + 1}`} className="h-28 w-full object-cover" loading="lazy" />
                  </a>
                ))}
              </div>
            )}

            <div className="mt-4">
              <p className="text-xs font-semibold text-ink">Verification documents</p>
              {Array.isArray(item.documents) && item.documents.length ? (
                <div className="mt-2 space-y-2">
                  {item.documents.map((doc) => (
                    <div key={doc.id || `${doc.documentType}-${doc.fileName}-${doc.submittedAt}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2 text-xs">
                      <div className="min-w-0">
                        <p className="font-medium text-ink">{doc.documentType}</p>
                        <p className="truncate text-muted">{doc.fileName || doc.fileUrl || "Document"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={doc.status === "approved" ? "verified" : doc.status === "rejected" ? "neutral" : "gold"}>{doc.status || "submitted"}</Badge>
                        {doc.fileUrl ? <a href={doc.fileUrl} target="_blank" rel="noreferrer" className="font-semibold text-plum-700 underline underline-offset-4">Open</a> : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted">No document records found.</p>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <label className="block">
                <span className="label">Review notes (optional, shown to host on rejection/suspension)</span>
                <textarea
                  rows={2}
                  className="field resize-none"
                  value={notesById[item.id] || ""}
                  onChange={(e) => setNotesById((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  placeholder="Add a clear reason or instruction..."
                />
              </label>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busyId === `${item.id}:reject`}
                  disabled={Boolean(busyId)}
                  onClick={() => act(item.id, "reject")}
                >
                  Reject
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  loading={busyId === `${item.id}:suspend`}
                  disabled={Boolean(busyId)}
                  onClick={() => act(item.id, "suspend")}
                >
                  Suspend
                </Button>
                <Button
                  size="sm"
                  icon="check"
                  loading={busyId === `${item.id}:approve`}
                  disabled={Boolean(busyId)}
                  onClick={() => act(item.id, "approve")}
                >
                  Approve
                </Button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
