"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AREAS,
  PROPERTY_TYPES,
  formatDate,
  toIso,
  typeLabel,
} from "@josstay/shared";
import { Badge, VerifiedBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useAuth, useCurrency, useToast } from "@/components/providers";
import { api } from "@/lib/api";
import { SUPPORT_WHATSAPP_URL } from "@/lib/contact";
import { EmptyState, LoadingResults } from "@/components/shared/states";

const TABS = [
  { id: "overview", label: "Overview", icon: "dashboard" },
  { id: "listings", label: "Listings", icon: "home" },
  { id: "calendar", label: "Calendar & prices", icon: "calendar" },
  { id: "payouts", label: "Payouts", icon: "wallet" },
];

const FALLBACK_HOST_BOOKINGS = [
  { guest: "Adaeze Okafor", property: "Crestview Boutique Hotel", unit: "Deluxe Room", dates: "5 – 8 Dec 2026", status: "Confirmed", gross: 301000, reference: "JS-8F2K1Q" },
  { guest: "Tunde Adewale", property: "Crestview Boutique Hotel", unit: "Executive Suite", dates: "12 – 14 Dec 2026", status: "Confirmed", gross: 260000, reference: "JS-HST101" },
  { guest: "Fatima Bello", property: "Crestview Boutique Hotel", unit: "Deluxe Room", dates: "28 – 30 Nov 2026", status: "Pending", gross: 181000, reference: "JS-HST102" },
  { guest: "Emeka Iwu", property: "Crestview Boutique Hotel", unit: "Crestview Suite", dates: "20 – 22 Nov 2026", status: "Completed", gross: 312000, reference: "JS-HST103" },
];

const FALLBACK_LISTINGS = [
  { id: "sample-1", name: "Crestview Boutique Hotel", type: "hotel", area: "Jos North", price: 85000, weekendPrice: 95000, status: "Live", verified: true, photoCount: 12, sample: true },
];

const FALLBACK_PAYOUTS = [
  { reference: "JS-HST100", gross: 301000, commission: 30100, net: 270900, status: "paid" },
  { reference: "JS-HST101", gross: 260000, commission: 26000, net: 234000, status: "scheduled" },
  { reference: "JS-HST102", gross: 181000, commission: 18100, net: 162900, status: "on_hold" },
];

const today = toIso(new Date());

const monthLabel = (date) => date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

const isLikelyUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));

const addIsoDays = (iso, days) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
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
      {hint && <p className="mt-0.5 text-[10px] text-muted">{hint}</p>}
    </div>
  );
}

const formatHostBookingDates = (booking) => {
  if (booking?.dates) return booking.dates;
  if (booking?.checkIn && booking?.checkOut) {
    return `${formatDate(booking.checkIn, { year: undefined })} – ${formatDate(booking.checkOut)}`;
  }
  return "Dates unavailable";
};

function Dashboard() {
  const router = useRouter();
  const params = useSearchParams();
  const auth = useAuth();
  const { format } = useCurrency();
  const { toast } = useToast();

  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [dashboard, setDashboard] = useState(null);
  const [payouts, setPayouts] = useState({ data: [], totals: null, sampleData: true });
  const [showForm, setShowForm] = useState(false);
  const [submittingListing, setSubmittingListing] = useState(false);
  const [savingPricing, setSavingPricing] = useState(false);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [blockMutatingDate, setBlockMutatingDate] = useState("");
  const [listingForm, setListingForm] = useState({ name: "", type: "apartment", area: "Rayfield", price: "", description: "", declaration: false });
  const [photos, setPhotos] = useState([]);
  const [idDoc, setIdDoc] = useState(null);
  const [ownershipDoc, setOwnershipDoc] = useState(null);
  const [errors, setErrors] = useState({});
  const [basePrice, setBasePrice] = useState(85000);
  const [weekendPrice, setWeekendPrice] = useState(95000);
  const [selectedListingId, setSelectedListingId] = useState("");
  const [blocks, setBlocks] = useState([]);
  const [cursor, setCursor] = useState(() => {
    const d = new Date(`${today}T12:00:00`);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const blocksRequestSeq = useRef(0);

  useEffect(() => {
    const requested = params.get("tab");
    if (TABS.some((t) => t.id === requested)) setTab(requested);
  }, [params]);

  const refreshHostData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setLoadError("");
    try {
      const [meRes, payoutsRes] = await Promise.all([
        api.get("/api/host/me", { cache: "no-store" }),
        api.get("/api/host/payouts", { cache: "no-store" }).catch(() => ({ data: [], totals: null, sampleData: true })),
      ]);
      setDashboard(meRes?.data || null);
      setPayouts({
        data: Array.isArray(payoutsRes?.data) ? payoutsRes.data : [],
        totals: payoutsRes?.totals || null,
        sampleData: Boolean(payoutsRes?.sampleData),
      });
      return { ok: true, sampleData: Boolean(meRes?.sampleData || payoutsRes?.sampleData) };
    } catch (error) {
      if (error?.status === 401) {
        setLoadError("auth_required");
      } else if (error?.status === 403) {
        setLoadError("forbidden");
      } else {
        setDashboard({
          host: { name: auth.user?.name || "Host" },
          listings: FALLBACK_LISTINGS,
          bookings: FALLBACK_HOST_BOOKINGS,
          stats: {
            listingsCount: FALLBACK_LISTINGS.length,
            upcomingBookings: FALLBACK_HOST_BOOKINGS.filter((b) => b.status === "Confirmed" || b.status === "Pending").length,
            gross: FALLBACK_HOST_BOOKINGS.reduce((sum, b) => sum + b.gross, 0),
            net: Math.round(FALLBACK_HOST_BOOKINGS.reduce((sum, b) => sum + b.gross, 0) * 0.9),
            pending: Math.round(FALLBACK_HOST_BOOKINGS.filter((b) => b.status === "Pending").reduce((sum, b) => sum + b.gross, 0) * 0.9),
            occupancyRate: 72,
          },
          sampleData: true,
        });
        setPayouts({
          data: FALLBACK_PAYOUTS,
          totals: {
            gross: FALLBACK_PAYOUTS.reduce((sum, p) => sum + p.gross, 0),
            net: FALLBACK_PAYOUTS.reduce((sum, p) => sum + p.net, 0),
            currency: "NGN",
          },
          sampleData: true,
        });
      }
      return { ok: false, error };
    } finally {
      if (!silent) setLoading(false);
    }
  }, [auth.user]);

  useEffect(() => {
    if (auth.isLoading) return;
    if (!auth.isAuthenticated) {
      setLoading(false);
      setLoadError("auth_required");
      return;
    }
    if (auth.user?.role && auth.user.role !== "host" && auth.user.role !== "admin") {
      setLoading(false);
      setLoadError("forbidden");
      return;
    }

    let active = true;
    (async () => {
      await refreshHostData();
      if (!active) return;
    })();
    return () => { active = false; };
  }, [auth.isLoading, auth.isAuthenticated, auth.user, refreshHostData]);

  const isSample = Boolean(dashboard?.sampleData || payouts?.sampleData);
  const listings = useMemo(() => {
    if (Array.isArray(dashboard?.listings) && dashboard.listings.length) return dashboard.listings;
    if (loading) return [];
    return isSample ? FALLBACK_LISTINGS : [];
  }, [dashboard?.listings, isSample, loading]);

  const hostBookings = useMemo(() => {
    if (Array.isArray(dashboard?.bookings) && dashboard.bookings.length) return dashboard.bookings;
    if (loading) return [];
    return isSample ? FALLBACK_HOST_BOOKINGS : [];
  }, [dashboard?.bookings, isSample, loading]);

  const hostName = dashboard?.host?.name || auth.user?.name || "Host";
  const hostFirstName = String(hostName).trim().split(/\s+/)[0] || "Host";

  useEffect(() => {
    if (!listings.length) {
      setSelectedListingId("");
      return;
    }
    setSelectedListingId((current) => {
      if (current && listings.some((l) => String(l.id || l.propertyId) === String(current))) return current;
      return String(listings[0].id || listings[0].propertyId || "");
    });
  }, [listings]);

  const selectedListing = useMemo(
    () => listings.find((l) => String(l.id || l.propertyId) === String(selectedListingId)) || listings[0] || null,
    [listings, selectedListingId],
  );

  useEffect(() => {
    if (!selectedListing) return;
    const base = Number(selectedListing.price) || 0;
    const weekend = Number(selectedListing.weekendPrice ?? selectedListing.price) || base;
    if (base > 0) setBasePrice(base);
    if (weekend > 0) setWeekendPrice(weekend);
  }, [selectedListing?.id, selectedListing?.price, selectedListing?.weekendPrice]);

  const canManageSelectedListingServer = Boolean(
    selectedListing && isLikelyUuid(selectedListing.id || selectedListing.propertyId) && !isSample
  );

  useEffect(() => {
    let active = true;
    const listingId = selectedListing?.id || selectedListing?.propertyId;
    if (!canManageSelectedListingServer || !listingId) {
      setBlocks([]);
      setBlocksLoading(false);
      return undefined;
    }

    const seq = ++blocksRequestSeq.current;
    setBlocksLoading(true);
    (async () => {
      try {
        const res = await api.get(`/api/host/listings/${listingId}/blocks`, { cache: "no-store" });
        if (!active || seq !== blocksRequestSeq.current) return;
        setBlocks(Array.isArray(res?.data) ? res.data : []);
      } catch (error) {
        if (!active || seq !== blocksRequestSeq.current) return;
        setBlocks([]);
        if (error?.status && error.status !== 404) {
          toast(error?.message || "Could not load calendar blocks", "error");
        }
      } finally {
        if (active && seq === blocksRequestSeq.current) setBlocksLoading(false);
      }
    })();

    return () => { active = false; };
  }, [canManageSelectedListingServer, selectedListing?.id, selectedListing?.propertyId, toast]);

  const blockedDatesInMonth = useMemo(() => {
    const set = new Set();
    if (!blocks?.length) return set;
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const monthEndExclusive = toIso(new Date(year, month + 1, 1));

    for (const block of blocks) {
      const start = String(block.startDate || "").slice(0, 10);
      const endExclusive = String(block.endDate || "").slice(0, 10);
      if (!start || !endExclusive || endExclusive <= start) continue;
      let d = start < monthStart ? monthStart : start;
      const endCap = endExclusive < monthEndExclusive ? endExclusive : monthEndExclusive;
      while (d < endCap) {
        set.add(d);
        d = addIsoDays(d, 1);
      }
    }
    return set;
  }, [blocks, cursor]);

  const monthStats = useMemo(() => {
    const year = cursor.getFullYear();
    const month = cursor.getMonth();
    const total = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const cells = [];
    for (let i = 0; i < firstDay; i += 1) cells.push(null);
    for (let d = 1; d <= total; d += 1) {
      const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dow = new Date(year, month, d).getDay();
      cells.push({ iso, day: d, weekend: dow === 0 || dow === 6 });
    }
    return cells;
  }, [cursor]);

  const gross = dashboard?.stats?.gross ?? hostBookings.reduce((sum, b) => sum + (Number(b.gross) || 0), 0);
  const pending = dashboard?.stats?.pending ?? Math.round(hostBookings.filter((b) => b.status === "Pending").reduce((sum, b) => sum + (Number(b.gross) || 0) * 0.9, 0));
  const netPayouts = dashboard?.stats?.net ?? Math.round(gross * 0.9);
  const upcomingBookingsCount = dashboard?.stats?.upcomingBookings ?? hostBookings.filter((b) => b.status === "Confirmed" || b.status === "Pending").length;
  const occupancyRate = dashboard?.stats?.occupancyRate ?? 0;

  const submitListing = async (e) => {
    e.preventDefault();
    if (submittingListing) return;
    const next = {};
    if (!listingForm.name.trim()) next.name = "Give your listing a name";
    if (!listingForm.price || Number(listingForm.price) < 5000) next.price = "Set a nightly price of at least ₦5,000";
    if (photos.length < 3) next.photos = "Upload at least 3 photos";
    if (!idDoc) next.idDoc = "Add a government-issued ID";
    if (!ownershipDoc) next.ownershipDoc = "Add proof of ownership or a letter of authority";
    if (!listingForm.declaration) next.declaration = "Please confirm the declaration";
    setErrors(next);
    if (Object.keys(next).length) return;

    if (isSample) {
      toast("Host data is in sample mode. Connect the host API/database to submit listings.", "info");
      return;
    }

    setSubmittingListing(true);
    try {
      const payload = {
        name: listingForm.name.trim(),
        type: listingForm.type,
        area: listingForm.area,
        price: Math.round(Number(listingForm.price)),
        description: listingForm.description?.trim() || undefined,
        photoCount: photos.length,
        hasIdDocument: Boolean(idDoc),
        hasOwnershipDocument: Boolean(ownershipDoc),
        idDocumentName: idDoc?.name || undefined,
        ownershipDocumentName: ownershipDoc?.name || undefined,
        declaration: Boolean(listingForm.declaration),
      };
      const res = await api.post("/api/host/listings", payload);
      toast("Listing submitted for review.", "success");
      setShowForm(false);
      setListingForm({ name: "", type: "apartment", area: "Rayfield", price: "", description: "", declaration: false });
      setPhotos([]);
      setIdDoc(null);
      setOwnershipDoc(null);
      setErrors({});
      await refreshHostData({ silent: true });
      const createdId = res?.data?.id || res?.data?.propertyId;
      if (createdId) setSelectedListingId(String(createdId));
      setTab("listings");
    } catch (error) {
      if (error?.status === 503 || error?.code === "NETWORK_ERROR" || error?.code === "REQUEST_ABORTED") {
        toast("Host listing service is unavailable right now. Please try again when live host services are available.", "error");
      } else {
        toast(error?.message || "Could not submit listing", "error");
      }
    } finally {
      setSubmittingListing(false);
    }
  };

  const savePricing = async () => {
    const listingId = selectedListing?.id || selectedListing?.propertyId;
    if (!listingId) {
      toast("Select a listing to update pricing.", "info");
      return;
    }
    if (!canManageSelectedListingServer) {
      toast("Pricing changes require a live host listing.", "info");
      return;
    }
    const base = Math.round(Number(basePrice) || 0);
    const weekend = Math.round(Number(weekendPrice) || 0);
    if (base < 1000 || weekend < base) {
      toast("Set a valid base price and a weekend price not lower than base.", "error");
      return;
    }

    setSavingPricing(true);
    try {
      await api.put(`/api/host/listings/${listingId}/pricing`, { basePrice: base, weekendPrice: weekend });
      toast("Pricing updated.", "success");
      setDashboard((current) => {
        if (!current) return current;
        const listingsNext = Array.isArray(current.listings)
          ? current.listings.map((l) => (String(l.id || l.propertyId) === String(listingId) ? { ...l, price: base, weekendPrice: weekend } : l))
          : current.listings;
        return { ...current, listings: listingsNext };
      });
    } catch (error) {
      toast(error?.message || "Could not save pricing", "error");
    } finally {
      setSavingPricing(false);
    }
  };

  const toggleDay = async (iso) => {
    const listingId = selectedListing?.id || selectedListing?.propertyId;
    if (!listingId) return;

    if (!canManageSelectedListingServer) {
      toast("Calendar blocks require a live host listing. Sample data cannot be modified.", "info");
      return;
    }

    if (blockMutatingDate) return;
    const existing = blocks.find((b) => {
      const start = String(b.startDate || "").slice(0, 10);
      const end = String(b.endDate || "").slice(0, 10);
      return start && end && iso >= start && iso < end;
    });

    setBlockMutatingDate(iso);
    try {
      if (existing) {
        await api.delete(`/api/host/listings/${listingId}/blocks/${existing.id}`);
        setBlocks((current) => current.filter((b) => b.id !== existing.id));
      } else {
        const res = await api.post(`/api/host/listings/${listingId}/blocks`, {
          startDate: iso,
          endDate: addIsoDays(iso, 1),
          reason: "Host blocked date",
        });
        if (res?.data) setBlocks((current) => [...current, res.data]);
        else {
          const fresh = await api.get(`/api/host/listings/${listingId}/blocks`, { cache: "no-store" });
          setBlocks(Array.isArray(fresh?.data) ? fresh.data : []);
        }
      }
    } catch (error) {
      toast(error?.message || "Could not update availability", "error");
    } finally {
      setBlockMutatingDate("");
    }
  };

  if (auth.isLoading || loading) {
    return (
      <div className="container-page py-10">
        <LoadingResults count={3} />
      </div>
    );
  }

  if (loadError === "auth_required") {
    return (
      <div className="container-page py-16">
        <EmptyState
          icon="home"
          title="Sign in to access host dashboard"
          description="Host tools are available when you are signed in as a host."
          actionLabel="Sign in"
          onAction={() => router.push("/account")}
        />
      </div>
    );
  }

  if (loadError === "forbidden") {
    return (
      <div className="container-page py-16">
        <EmptyState
          icon="shield"
          title="Host access required"
          description="This dashboard is for host accounts. Create or switch to a host account to continue."
          actionLabel="Become a host"
          onAction={() => router.push("/host")}
        />
      </div>
    );
  }

  const recentBookings = hostBookings.slice(0, 6);
  const payoutRows = payouts?.data?.length ? payouts.data : [];
  const blockedCountInMonth = blockedDatesInMonth.size;
  const monthDays = monthStats.filter(Boolean).length;

  return (
    <div className="container-page overflow-x-hidden pb-16 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-plum-600">Host dashboard</span>
          <h1 className="mt-2 font-display text-[28px] font-bold leading-none tracking-tightest text-ink sm:text-[34px]">Good to see you, {hostFirstName} 👋</h1>
          {isSample && <p className="mt-1 text-[11px] text-muted">Showing sample data while live host data is unavailable.</p>}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/" className="hidden items-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2.5 text-xs font-semibold text-ink hover:border-plum-200 sm:inline-flex"><Icon name="logout" className="h-4 w-4" /> Guest view</Link>
          <Button size="sm" icon="plus" onClick={() => { setShowForm(true); setTab("listings"); }}>Add listing</Button>
        </div>
      </div>

      <div className="sticky top-16 z-30 -mx-4 mt-4 border-b border-line bg-canvas/95 px-4 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-1">
        <div className="no-scrollbar flex gap-1 overflow-x-auto py-1">
          {TABS.map((item) => (
            <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2.5 text-xs font-semibold transition ${tab === item.id ? "bg-plum-700 text-white" : "text-muted hover:bg-white hover:text-ink"}`} aria-pressed={tab === item.id}>
              <Icon name={item.icon} className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" && (
        <div className="mt-5 space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Listings" value={listings.length} hint={`${listings.filter((l) => l.status === "Live").length} live`} icon="home" />
            <StatCard label="Upcoming bookings" value={upcomingBookingsCount} hint={recentBookings[0] ? `Latest: ${formatHostBookingDates(recentBookings[0])}` : "No bookings yet"} icon="calendar" tone="gold" />
            <StatCard label="Occupancy" value={`${occupancyRate}%`} hint="Estimated" icon="dashboard" tone="green" />
            <StatCard label="Net payouts" value={format(netPayouts)} hint="After 10% commission" icon="wallet" tone="green" />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <div className="min-w-0 rounded-xl border border-line bg-white p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-[19px] font-bold tracking-tight text-ink">Recent bookings</h2>
                <button type="button" onClick={() => setTab("payouts")} className="text-xs font-semibold text-plum-700">View payouts</button>
              </div>
              {recentBookings.length === 0 ? (
                <p className="text-xs text-muted">No bookings yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-left text-xs">
                    <thead>
                      <tr className="border-b border-line text-[10px] uppercase tracking-wide text-muted">
                        <th className="pb-2 font-semibold">Guest</th>
                        <th className="pb-2 font-semibold">Dates</th>
                        <th className="pb-2 font-semibold">Status</th>
                        <th className="pb-2 text-right font-semibold">Payout</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentBookings.map((booking, i) => (
                        <tr key={booking.reference || `${booking.guest}-${i}`} className="border-b border-line/60 last:border-0">
                          <td className="py-2.5"><p className="font-semibold text-ink">{booking.guest}</p><p className="text-[10px] text-muted">{booking.unit || booking.property || "Stay"}</p></td>
                          <td className="py-2.5 text-muted">{formatHostBookingDates(booking)}</td>
                          <td className="py-2.5"><Badge tone={booking.status === "Confirmed" || booking.status === "Completed" ? "verified" : booking.status === "Pending" ? "gold" : "neutral"}>{booking.status}</Badge></td>
                          <td className="py-2.5 text-right font-semibold text-ink">{format(Math.round((Number(booking.gross) || 0) * 0.9))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="min-w-0 space-y-4">
              <div className="rounded-xl border border-line bg-white p-4">
                <h2 className="text-sm font-bold text-ink">Payout summary</h2>
                <div className="mt-3 space-y-2 text-xs">
                  <div className="flex justify-between"><span className="text-muted">Gross earnings</span><span className="font-semibold text-ink">{format(gross)}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Commission (10%)</span><span className="font-semibold text-ink">−{format(Math.round(gross * 0.1))}</span></div>
                  <div className="flex justify-between border-t border-line pt-2"><span className="text-muted">Net earned</span><span className="font-bold text-emerald-700">{format(netPayouts)}</span></div>
                  <div className="flex justify-between"><span className="text-muted">Pending</span><span className="font-semibold text-plum-700">{format(pending)}</span></div>
                </div>
                <Button full size="sm" variant="secondary" className="mt-3" onClick={() => setTab("payouts")}>Manage payouts</Button>
              </div>

              <div className="rounded-xl border border-gold-300 bg-gold-100/70 p-4">
                <p className="text-xs font-bold text-plum-700">Host account</p>
                <p className="mt-1 text-[11px] leading-relaxed text-plum-700">Listing, pricing and availability tools are connected to host APIs when live data is available. Document file uploads are finalized in a later step.</p>
                <button type="button" onClick={() => router.push("/help")} className="mt-2 text-[11px] font-bold text-plum-700 underline underline-offset-4">Host help centre</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "listings" && (
        <div className="mt-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-display text-[22px] font-bold tracking-tight text-ink">Your listings</h2>
              <p className="text-xs text-muted">Listings are loaded from your host account. New submissions are sent for review through the host API when available.</p>
            </div>
            <Button size="sm" variant="secondary" icon="plus" onClick={() => setShowForm((s) => !s)}>{showForm ? "Close form" : "Add listing"}</Button>
          </div>

          {showForm && (
            <form onSubmit={submitListing} className="rounded-xl border border-line bg-white p-4 sm:p-5">
              <h3 className="font-display text-[19px] font-bold tracking-tight text-ink">Add a new listing</h3>
              <p className="mt-0.5 text-xs text-muted">Submit listing details for review. Photo/document file uploads are recorded as verification metadata for now and will be fully uploaded in the Cloudinary integration step.</p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="label">Listing name</span>
                  <input value={listingForm.name} onChange={(e) => { setListingForm((f) => ({ ...f, name: e.target.value })); setErrors((er) => ({ ...er, name: undefined })); }} className={`field ${errors.name ? "!border-red-400" : ""}`} placeholder="Rayfield Garden Apartment" />
                  {errors.name && <span className="mt-1 block text-[11px] text-red-600">{errors.name}</span>}
                </label>

                <label className="block">
                  <span className="label">Property type</span>
                  <select value={listingForm.type} onChange={(e) => setListingForm((f) => ({ ...f, type: e.target.value }))} className="field">
                    {PROPERTY_TYPES.map((t) => (<option key={t.id} value={t.id}>{t.label}</option>))}
                  </select>
                </label>

                <label className="block">
                  <span className="label">Area</span>
                  <select value={listingForm.area} onChange={(e) => setListingForm((f) => ({ ...f, area: e.target.value }))} className="field">
                    {AREAS.map((area) => (<option key={area} value={area}>{area}</option>))}
                  </select>
                </label>

                <label className="block">
                  <span className="label">Nightly price (₦)</span>
                  <input type="number" min={5000} step={1000} value={listingForm.price} onChange={(e) => { setListingForm((f) => ({ ...f, price: e.target.value })); setErrors((er) => ({ ...er, price: undefined })); }} className={`field ${errors.price ? "!border-red-400" : ""}`} placeholder="55000" />
                  {errors.price && <span className="mt-1 block text-[11px] text-red-600">{errors.price}</span>}
                </label>

                <div className="min-w-0">
                  <span className="label">Photo upload</span>
                  <label className="flex min-w-0 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line bg-canvas/60 px-3 py-3 text-xs text-muted hover:border-plum-300">
                    <Icon name="upload" className="h-4 w-4 shrink-0 text-plum-600" />
                    <span className="min-w-0 truncate">{photos.length ? `${photos.length} photos selected` : "Choose at least 3 photos"}</span>
                    <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { setPhotos(Array.from(e.target.files || [])); setErrors((er) => ({ ...er, photos: undefined })); }} />
                  </label>
                  {errors.photos && <span className="mt-1 block text-[11px] text-red-600">{errors.photos}</span>}
                </div>

                <div className="sm:col-span-2">
                  <label className="block">
                    <span className="label">Description</span>
                    <textarea rows={3} value={listingForm.description} onChange={(e) => setListingForm((f) => ({ ...f, description: e.target.value }))} className="field resize-none" placeholder="What makes your place special? Mention power, water, security and the neighbourhood." />
                  </label>
                </div>

                <div className="min-w-0">
                  <span className="label">Verification · government ID</span>
                  <label className="flex min-w-0 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line bg-canvas/60 px-3 py-3 text-xs text-muted hover:border-plum-300">
                    <Icon name="shield" className="h-4 w-4 shrink-0 text-plum-600" />
                    <span className="min-w-0 truncate">{idDoc ? idDoc.name : "Passport, NIN or driver's licence"}</span>
                    <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => { setIdDoc(e.target.files?.[0] || null); setErrors((er) => ({ ...er, idDoc: undefined })); }} />
                  </label>
                  {errors.idDoc && <span className="mt-1 block text-[11px] text-red-600">{errors.idDoc}</span>}
                </div>

                <div className="min-w-0">
                  <span className="label">Verification · ownership</span>
                  <label className="flex min-w-0 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-line bg-canvas/60 px-3 py-3 text-xs text-muted hover:border-plum-300">
                    <Icon name="home" className="h-4 w-4 shrink-0 text-plum-600" />
                    <span className="min-w-0 truncate">{ownershipDoc ? ownershipDoc.name : "Proof of ownership or authority"}</span>
                    <input type="file" accept="image/*,application/pdf" className="sr-only" onChange={(e) => { setOwnershipDoc(e.target.files?.[0] || null); setErrors((er) => ({ ...er, ownershipDoc: undefined })); }} />
                  </label>
                  {errors.ownershipDoc && <span className="mt-1 block text-[11px] text-red-600">{errors.ownershipDoc}</span>}
                </div>

                <label className="flex cursor-pointer items-start gap-2.5 sm:col-span-2">
                  <input type="checkbox" checked={listingForm.declaration} onChange={(e) => { setListingForm((f) => ({ ...f, declaration: e.target.checked })); setErrors((er) => ({ ...er, declaration: undefined })); }} className="mt-0.5 h-4 w-4 accent-plum-600" />
                  <span className="text-[11px] leading-relaxed text-muted">I confirm this is my property or that I have authority to list it, and the information provided is accurate.</span>
                </label>
                {errors.declaration && <span className="text-[11px] text-red-600 sm:col-span-2">{errors.declaration}</span>}

                <div className="sm:col-span-2">
                  <Button type="submit" full size="lg" icon="check" loading={submittingListing} disabled={submittingListing}>Submit listing for verification</Button>
                </div>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {listings.length === 0 ? (
              <EmptyState icon="home" title="No listings yet" description="Your listings will appear here once you add them." />
            ) : listings.map((listing) => {
              const listingId = String(listing.id || listing.propertyId || listing.slug || listing.name);
              const isSelected = String(selectedListing?.id || selectedListing?.propertyId) === String(listing.id || listing.propertyId);
              return (
                <div key={listingId} className={`rounded-xl border bg-white p-4 ${isSelected ? "border-plum-300 ring-1 ring-plum-100" : "border-line"}`}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-plum-50 text-plum-700"><Icon name="home" className="h-5 w-5" /></span>
                      <div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-sm font-bold text-ink">{listing.name}</p>
                          {listing.verified ? <VerifiedBadge /> : <Badge tone="gold">{listing.status || "In review"}</Badge>}
                        </div>
                        <p className="mt-0.5 text-[11px] text-muted">{typeLabel(listing.type)} · {listing.area} · {listing.photoCount ?? (Array.isArray(listing.images) ? listing.images.length : 0)} photos</p>
                        <p className="mt-1 text-xs font-semibold text-ink">{format(listing.price)} <span className="font-normal text-muted">/ night</span>{Number(listing.weekendPrice) > Number(listing.price) ? <span className="font-normal text-muted"> · weekends {format(listing.weekendPrice)}</span> : null}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={listing.status === "Live" ? "verified" : listing.status === "Rejected" || listing.status === "Suspended" ? "neutral" : "gold"}>{listing.status || (listing.verified ? "Live" : "In review")}</Badge>
                      {listing.slug ? (
                        <Button size="sm" variant="secondary" onClick={() => router.push(`/property/${listing.slug}`)}>View</Button>
                      ) : null}
                      <Button size="sm" variant="secondary" onClick={() => { setSelectedListingId(String(listing.id || listing.propertyId || "")); setTab("calendar"); }}>Manage</Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === "calendar" && (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-xl border border-line bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-[19px] font-bold tracking-tight text-ink">Availability</h2>
                <p className="text-xs text-muted">
                  {canManageSelectedListingServer
                    ? "Click a date to block or unblock it for the selected listing."
                    : isSample
                      ? "Sample mode: calendar changes are unavailable until live host data is connected."
                      : "Select a live listing to manage server-backed availability blocks."}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-line" aria-label="Previous month"><Icon name="chevronLeft" className="h-4 w-4" /></button>
                <span className="min-w-[130px] text-center text-xs font-semibold text-ink">{monthLabel(cursor)}</span>
                <button type="button" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-line" aria-label="Next month"><Icon name="chevronRight" className="h-4 w-4" /></button>
              </div>
            </div>

            {listings.length > 0 && (
              <label className="mt-4 block">
                <span className="label">Listing</span>
                <select
                  value={String(selectedListing?.id || selectedListing?.propertyId || "")}
                  onChange={(e) => setSelectedListingId(e.target.value)}
                  className="field"
                >
                  {listings.map((listing) => {
                    const id = String(listing.id || listing.propertyId || listing.slug || listing.name);
                    return <option key={id} value={id}>{listing.name}</option>;
                  })}
                </select>
              </label>
            )}

            <div className="mt-4 grid grid-cols-7 gap-y-1 text-center">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (<span key={`${d}-${i}`} className="pb-1 text-[10px] font-semibold uppercase text-muted">{d}</span>))}
              {monthStats.map((cell, i) => {
                if (!cell) return <span key={`empty-${i}`} />;
                const isBlocked = blockedDatesInMonth.has(cell.iso);
                const isMutating = blockMutatingDate === cell.iso;
                return (
                  <button
                    key={cell.iso}
                    type="button"
                    onClick={() => toggleDay(cell.iso)}
                    disabled={!canManageSelectedListingServer || blocksLoading || Boolean(blockMutatingDate)}
                    className={`mx-auto grid h-10 w-10 place-items-center rounded-lg text-xs font-medium transition ${isBlocked ? "bg-red-50 text-red-500 line-through" : cell.weekend ? "bg-gold-100/70 text-ink hover:bg-gold-300" : "text-ink hover:bg-plum-50"} ${(!canManageSelectedListingServer || blocksLoading || blockMutatingDate) ? "opacity-70" : ""}`}
                    aria-label={`${formatDate(cell.iso)} — ${isBlocked ? "blocked" : "available"}`}
                    title={isMutating ? "Updating..." : isBlocked ? "Blocked" : "Available"}
                  >
                    {isMutating ? "…" : cell.day}
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted">
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-gold-300" /> Weekend</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-100" /> Blocked</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border border-plum-200 bg-plum-50" /> Available</span>
            </div>

            <p className="mt-4 rounded-lg bg-plum-50 px-3 py-2 text-[11px] text-plum-700">
              {blocksLoading ? "Loading availability blocks…" : `${blockedCountInMonth} date${blockedCountInMonth === 1 ? "" : "s"} blocked in ${monthLabel(cursor)}${canManageSelectedListingServer ? " (server-backed)." : " (view only)."}`}
            </p>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-line bg-white p-4 sm:p-5">
              <h2 className="font-display text-[19px] font-bold tracking-tight text-ink">Nightly pricing</h2>
              <p className="text-xs text-muted">Set base and weekend rates for the selected listing.</p>
              <div className="mt-4 space-y-3">
                <label className="block"><span className="label">Base price (Sun–Thu)</span><input type="number" value={basePrice} step={1000} min={1000} onChange={(e) => setBasePrice(Number(e.target.value))} className="field" disabled={!selectedListing} /></label>
                <label className="block"><span className="label">Weekend price (Fri–Sat)</span><input type="number" value={weekendPrice} step={1000} min={1000} onChange={(e) => setWeekendPrice(Number(e.target.value))} className="field" disabled={!selectedListing} /></label>
              </div>
              <Button full className="mt-4" onClick={savePricing} loading={savingPricing} disabled={!selectedListing || savingPricing}>Save price changes</Button>
              {!canManageSelectedListingServer && selectedListing && (
                <p className="mt-2 text-[11px] text-muted">Pricing changes are available for live host listings only.</p>
              )}
            </div>

            <div className="rounded-xl border border-line bg-white p-4">
              <h3 className="text-sm font-bold text-ink">Calendar summary</h3>
              <ul className="mt-2 space-y-1.5 text-[11px] text-muted">
                <li className="flex justify-between"><span>Available nights (month view)</span><strong className="text-ink">{Math.max(monthDays - blockedCountInMonth, 0)}</strong></li>
                <li className="flex justify-between"><span>Blocked nights (month view)</span><strong className="text-ink">{blockedCountInMonth}</strong></li>
                <li className="flex justify-between"><span>Base rate</span><strong className="text-ink">{format(basePrice)}</strong></li>
                <li className="flex justify-between"><span>Weekend rate</span><strong className="text-ink">{format(weekendPrice)}</strong></li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {tab === "payouts" && (
        <div className="mt-5 space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Pending" value={format(pending)} hint="Awaiting settlement" icon="wallet" tone="gold" />
            <StatCard label="Gross earnings" value={format(gross)} hint="Recorded bookings" icon="dashboard" />
            <StatCard label="Commission" value={format(Math.round(gross * 0.1))} hint="10% platform fee" icon="sliders" />
            <StatCard label="Net earned" value={format(netPayouts)} hint="After commission" icon="checkCircle" tone="green" />
          </div>

          <div className="min-w-0 rounded-xl border border-line bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0"><h2 className="font-display text-[19px] font-bold tracking-tight text-ink">Payout history</h2><p className="text-xs text-muted">Settlements and payout records for your account.</p></div>
              <Button size="sm" variant="secondary" icon="bank" onClick={() => toast("Payout requests are handled by support for now.", "info")}>Request payout</Button>
            </div>

            {payoutRows.length === 0 ? (
              <p className="mt-4 text-xs text-muted">No payout records yet.</p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-line text-[10px] uppercase tracking-wide text-muted">
                      <th className="pb-2 font-semibold">Reference</th><th className="pb-2 font-semibold">Gross</th><th className="pb-2 text-right font-semibold">Commission</th><th className="pb-2 text-right font-semibold">Net</th><th className="pb-2 text-right font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payoutRows.map((payout, i) => (
                      <tr key={payout.reference || i} className="border-b border-line/60 last:border-0">
                        <td className="py-2.5 font-mono text-[11px] font-semibold text-ink">{payout.reference}</td>
                        <td className="py-2.5 text-ink">{format(payout.gross)}</td>
                        <td className="py-2.5 text-right text-muted">{format(payout.commission ?? Math.round((payout.gross || 0) - (payout.net || 0)))}</td>
                        <td className="py-2.5 text-right font-semibold text-ink">{format(payout.net)}</td>
                        <td className="py-2.5 text-right"><Badge tone={payout.status === "paid" ? "verified" : payout.status === "scheduled" ? "gold" : "neutral"}>{payout.status === "paid" ? "Paid" : payout.status === "scheduled" ? "Scheduled" : "On hold"}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-white p-4">
              <h3 className="text-sm font-bold text-ink">Payout details</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">Bank account management and payout requests will be managed in a dedicated secure flow.</p>
            </div>
            <div className="rounded-xl border border-line bg-white p-4">
              <h3 className="text-sm font-bold text-ink">Need a hand?</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">Questions about commission, refunds or payouts? Our host team replies on WhatsApp.</p>
              <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 underline underline-offset-4"><Icon name="whatsapp" className="h-3.5 w-3.5" /> Chat with JosStay support</a>
            </div>
          </div>
        </div>
      )}

      <p className="mt-8 text-center text-[10px] text-muted">
        Host dashboard{isSample ? " · showing sample data where live data is unavailable" : ""}.
        <Link href="/help" className="ml-1 font-semibold text-plum-700 underline underline-offset-4">Host help centre</Link>
      </p>
    </div>
  );
}

export function DashboardView() {
  return (
    <Suspense fallback={<div className="container-page py-16 text-center text-sm text-muted">Loading host dashboard…</div>}>
      <Dashboard />
    </Suspense>
  );
}
