"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
import { useCurrency, useToast } from "@/components/providers";

const TABS = [
  { id: "overview", label: "Overview", icon: "dashboard" },
  { id: "listings", label: "Listings", icon: "home" },
  { id: "calendar", label: "Calendar & prices", icon: "calendar" },
  { id: "payouts", label: "Payouts", icon: "wallet" },
];

const HOST_BOOKINGS = [
  { guest: "Adaeze Okafor", property: "Crestview Boutique Hotel", unit: "Deluxe Room", dates: "5 – 8 Dec 2026", status: "Confirmed", gross: 301000 },
  { guest: "Tunde Adewale", property: "Crestview Boutique Hotel", unit: "Executive Suite", dates: "12 – 14 Dec 2026", status: "Confirmed", gross: 260000 },
  { guest: "Fatima Bello", property: "Crestview Boutique Hotel", unit: "Deluxe Room", dates: "28 – 30 Nov 2026", status: "Pending", gross: 181000 },
  { guest: "Emeka Iwu", property: "Crestview Boutique Hotel", unit: "Crestview Suite", dates: "20 – 22 Nov 2026", status: "Completed", gross: 312000 },
];

const today = toIso(new Date());

const monthLabel = (date) => date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });

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

function Dashboard() {
  const params = useSearchParams();
  const { format } = useCurrency();
  const { toast } = useToast();

  const [tab, setTab] = useState("overview");
  const [hostName, setHostName] = useState("Grace");
  const [listings, setListings] = useState([
    { id: "sample-1", name: "Crestview Boutique Hotel", type: "hotel", area: "Jos North", price: 85000, status: "Live", verified: true, photoCount: 12 },
  ]);
  const [showForm, setShowForm] = useState(false);
  const [listingForm, setListingForm] = useState({ name: "", type: "apartment", area: "Rayfield", price: "", description: "", declaration: false });
  const [photos, setPhotos] = useState([]);
  const [idDoc, setIdDoc] = useState(null);
  const [ownershipDoc, setOwnershipDoc] = useState(null);
  const [errors, setErrors] = useState({});
  const [basePrice, setBasePrice] = useState(85000);
  const [weekendPrice, setWeekendPrice] = useState(95000);
  const [cursor, setCursor] = useState(() => {
    const d = new Date(`${today}T12:00:00`);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [blocked, setBlocked] = useState(() => new Set(["2026-11-24", "2026-11-25", "2026-12-01"]));

  useEffect(() => {
    const requested = params.get("tab");
    if (TABS.some((t) => t.id === requested)) setTab(requested);
    try {
      const stored = window.localStorage.getItem("josstay-host-name");
      if (stored) setHostName(stored.split(" ")[0]);
    } catch {}
  }, [params]);

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

  const netPayouts = Math.round(HOST_BOOKINGS.filter((b) => b.status !== "Pending").reduce((sum, b) => sum + b.gross * 0.9, 0));
  const gross = HOST_BOOKINGS.reduce((sum, b) => sum + b.gross, 0);
  const pending = Math.round(HOST_BOOKINGS.filter((b) => b.status === "Pending").reduce((sum, b) => sum + b.gross * 0.9, 0));

  const submitListing = (e) => {
    e.preventDefault();
    const next = {};
    if (!listingForm.name.trim()) next.name = "Give your listing a name";
    if (!listingForm.price || Number(listingForm.price) < 5000) next.price = "Set a nightly price of at least ₦5,000";
    if (photos.length < 3) next.photos = "Upload at least 3 photos";
    if (!idDoc) next.idDoc = "Add a government-issued ID";
    if (!ownershipDoc) next.ownershipDoc = "Add proof of ownership or a letter of authority";
    if (!listingForm.declaration) next.declaration = "Please confirm the declaration";
    setErrors(next);
    if (Object.keys(next).length) return;

    setListings((all) => [
      { id: `new-${Date.now()}`, name: listingForm.name, type: listingForm.type, area: listingForm.area, price: Number(listingForm.price), status: "In review", verified: false, photoCount: photos.length },
      ...all,
    ]);
    toast("Listing submitted for verification (demo)", "success");
    setShowForm(false);
    setListingForm({ name: "", type: "apartment", area: "Rayfield", price: "", description: "", declaration: false });
    setPhotos([]);
    setIdDoc(null);
    setOwnershipDoc(null);
    setErrors({});
  };

  const toggleDay = (iso) => {
    setBlocked((current) => {
      const next = new Set(current);
      if (next.has(iso)) next.delete(iso);
      else next.add(iso);
      return next;
    });
  };

  return (
    <div className="container-page overflow-x-hidden pb-16 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-plum-600">Host dashboard</span>
          <h1 className="mt-2 font-display text-[28px] font-bold leading-none tracking-tightest text-ink sm:text-[34px]">Good to see you, {hostName} 👋</h1>
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
            <StatCard label="Listings" value={listings.length} hint="1 live · 0 paused" icon="home" />
            <StatCard label="Upcoming bookings" value={2} hint="Next: 28 Nov 2026" icon="calendar" tone="gold" />
            <StatCard label="Occupancy" value="72%" hint="Last 30 days" icon="dashboard" tone="green" />
            <StatCard label="Net payouts" value={format(netPayouts)} hint="After 10% commission" icon="wallet" tone="green" />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <div className="min-w-0 rounded-xl border border-line bg-white p-4 sm:p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-[19px] font-bold tracking-tight text-ink">Recent bookings</h2>
                <button type="button" onClick={() => setTab("payouts")} className="text-xs font-semibold text-plum-700">View payouts</button>
              </div>
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
                    {HOST_BOOKINGS.map((booking) => (
                      <tr key={booking.guest} className="border-b border-line/60 last:border-0">
                        <td className="py-2.5"><p className="font-semibold text-ink">{booking.guest}</p><p className="text-[10px] text-muted">{booking.unit}</p></td>
                        <td className="py-2.5 text-muted">{booking.dates}</td>
                        <td className="py-2.5"><Badge tone={booking.status === "Confirmed" ? "verified" : booking.status === "Pending" ? "gold" : "neutral"}>{booking.status}</Badge></td>
                        <td className="py-2.5 text-right font-semibold text-ink">{format(Math.round(booking.gross * 0.9))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                <Button full size="sm" variant="secondary" className="mt-3" onClick={() => { setTab("payouts"); toast("Opened payout details", "default"); }}>Manage payouts</Button>
              </div>

              <div className="rounded-xl border border-gold-300 bg-gold-100/70 p-4">
                <p className="text-xs font-bold text-plum-700">Profile 80% complete</p>
                <p className="mt-1 text-[11px] leading-relaxed text-plum-700">Add a profile photo and confirm your phone number to build guest trust.</p>
                <button type="button" onClick={() => toast("Profile settings (demo)", "default")} className="mt-2 text-[11px] font-bold text-plum-700 underline underline-offset-4">Finish profile</button>
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
              <p className="text-xs text-muted">Photos and verification documents are required before going live.</p>
            </div>
            <Button size="sm" variant="secondary" icon="plus" onClick={() => setShowForm((s) => !s)}>{showForm ? "Close form" : "Add listing"}</Button>
          </div>

          {showForm && (
            <form onSubmit={submitListing} className="rounded-xl border border-line bg-white p-4 sm:p-5">
              <h3 className="font-display text-[19px] font-bold tracking-tight text-ink">Add a new listing</h3>
              <p className="mt-0.5 text-xs text-muted">Demo form — files are not uploaded anywhere.</p>

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
                  <Button type="submit" full size="lg" icon="check">Submit listing for verification</Button>
                </div>
              </div>
            </form>
          )}

          <div className="space-y-3">
            {listings.map((listing) => (
              <div key={listing.id} className="rounded-xl border border-line bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-plum-50 text-plum-700"><Icon name="home" className="h-5 w-5" /></span>
                    <div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="text-sm font-bold text-ink">{listing.name}</p>
                        {listing.verified ? <VerifiedBadge /> : <Badge tone="gold">In review</Badge>}
                      </div>
                      <p className="mt-0.5 text-[11px] text-muted">{typeLabel(listing.type)} · {listing.area} · {listing.photoCount} photos</p>
                      <p className="mt-1 text-xs font-semibold text-ink">{format(listing.price)} <span className="font-normal text-muted">/ night</span></p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={listing.status === "Live" ? "verified" : "gold"}>{listing.status}</Badge>
                    <Button size="sm" variant="secondary" onClick={() => { setTab("calendar"); toast("Calendar opened", "default"); }}>Manage</Button>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5 text-[10px] text-muted">
                  <span>Verification documents received</span>
                  <button type="button" onClick={() => toast("Listing editor is mocked in this demo", "default")} className="font-semibold text-plum-700">Edit listing</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "calendar" && (
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="rounded-xl border border-line bg-white p-4 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-[19px] font-bold tracking-tight text-ink">Availability</h2>
                <p className="text-xs text-muted">Tap a date to block or unblock it.</p>
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-line" aria-label="Previous month"><Icon name="chevronLeft" className="h-4 w-4" /></button>
                <span className="min-w-[130px] text-center text-xs font-semibold text-ink">{monthLabel(cursor)}</span>
                <button type="button" onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))} className="grid h-8 w-8 place-items-center rounded-lg border border-line" aria-label="Next month"><Icon name="chevronRight" className="h-4 w-4" /></button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-7 gap-y-1 text-center">
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (<span key={`${d}-${i}`} className="pb-1 text-[10px] font-semibold uppercase text-muted">{d}</span>))}
              {monthStats.map((cell, i) => {
                if (!cell) return <span key={`empty-${i}`} />;
                const isBlocked = blocked.has(cell.iso);
                return (
                  <button key={cell.iso} type="button" onClick={() => toggleDay(cell.iso)} className={`mx-auto grid h-10 w-10 place-items-center rounded-lg text-xs font-medium transition ${isBlocked ? "bg-red-50 text-red-500 line-through" : cell.weekend ? "bg-gold-100/70 text-ink hover:bg-gold-300" : "text-ink hover:bg-plum-50"}`} aria-label={`${formatDate(cell.iso)} — ${isBlocked ? "blocked" : "available"}`}>{cell.day}</button>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted">
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-gold-300" /> Weekend</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-100" /> Blocked</span>
              <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full border border-plum-200 bg-plum-50" /> Available</span>
            </div>

            <p className="mt-4 rounded-lg bg-plum-50 px-3 py-2 text-[11px] text-plum-700">{blocked.size} date{blocked.size === 1 ? "" : "s"} blocked · changes are saved locally for this demo.</p>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-line bg-white p-4 sm:p-5">
              <h2 className="font-display text-[19px] font-bold tracking-tight text-ink">Nightly pricing</h2>
              <p className="text-xs text-muted">Base and weekend rates for all units.</p>
              <div className="mt-4 space-y-3">
                <label className="block"><span className="label">Base price (Sun–Thu)</span><input type="number" value={basePrice} step={1000} min={5000} onChange={(e) => setBasePrice(Number(e.target.value))} className="field" /></label>
                <label className="block"><span className="label">Weekend price (Fri–Sat)</span><input type="number" value={weekendPrice} step={1000} min={5000} onChange={(e) => setWeekendPrice(Number(e.target.value))} className="field" /></label>
              </div>
              <Button full className="mt-4" onClick={() => toast("Prices updated (demo)", "success")}>Save price changes</Button>
            </div>

            <div className="rounded-xl border border-line bg-white p-4">
              <h3 className="text-sm font-bold text-ink">Calendar summary</h3>
              <ul className="mt-2 space-y-1.5 text-[11px] text-muted">
                <li className="flex justify-between"><span>Available nights</span><strong className="text-ink">{monthStats.filter(Boolean).length - blocked.size}</strong></li>
                <li className="flex justify-between"><span>Blocked nights</span><strong className="text-ink">{blocked.size}</strong></li>
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
            <StatCard label="Next payout" value={format(pending)} hint="Scheduled 1 Dec 2026" icon="wallet" tone="gold" />
            <StatCard label="Gross earnings" value={format(gross)} hint="Last 90 days" icon="dashboard" />
            <StatCard label="Commission" value={format(Math.round(gross * 0.1))} hint="10% platform fee" icon="sliders" />
            <StatCard label="Net earned" value={format(netPayouts)} hint="Ready to withdraw" icon="checkCircle" tone="green" />
          </div>

          <div className="min-w-0 rounded-xl border border-line bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0"><h2 className="font-display text-[19px] font-bold tracking-tight text-ink">Payout history</h2><p className="text-xs text-muted">Settlement to your Nigerian bank account.</p></div>
              <Button size="sm" variant="secondary" icon="bank" onClick={() => toast("Payout request submitted (demo)", "success")}>Request payout</Button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead>
                  <tr className="border-b border-line text-[10px] uppercase tracking-wide text-muted">
                    <th className="pb-2 font-semibold">Reference</th><th className="pb-2 font-semibold">Guest</th><th className="pb-2 font-semibold">Dates</th><th className="pb-2 text-right font-semibold">Gross</th><th className="pb-2 text-right font-semibold">Net</th><th className="pb-2 text-right font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {HOST_BOOKINGS.map((booking, i) => (
                    <tr key={booking.guest} className="border-b border-line/60 last:border-0">
                      <td className="py-2.5 font-mono text-[11px] font-semibold text-ink">JS-HST{100 + i}</td>
                      <td className="py-2.5 text-ink">{booking.guest}</td>
                      <td className="py-2.5 text-muted">{booking.dates}</td>
                      <td className="py-2.5 text-right text-muted">{format(booking.gross)}</td>
                      <td className="py-2.5 text-right font-semibold text-ink">{format(Math.round(booking.gross * 0.9))}</td>
                      <td className="py-2.5 text-right"><Badge tone={booking.status === "Completed" ? "verified" : booking.status === "Pending" ? "gold" : "neutral"}>{booking.status === "Completed" ? "Paid" : booking.status === "Pending" ? "Scheduled" : "On hold"}</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[10px] text-muted">Payouts are sample data. In production, Paystack transfers settle T+1 after guest check-in.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-white p-4">
              <h3 className="text-sm font-bold text-ink">Bank account</h3>
              <p className="mt-1 text-[11px] text-muted">Wema Bank · 0123456789</p>
              <p className="text-[11px] text-muted">JosStay Host · Grace Pam</p>
              <button type="button" onClick={() => toast("Bank details editor (demo)", "default")} className="mt-2 text-[11px] font-semibold text-plum-700 underline underline-offset-4">Update account</button>
            </div>
            <div className="rounded-xl border border-line bg-white p-4">
              <h3 className="text-sm font-bold text-ink">Need a hand?</h3>
              <p className="mt-1 text-[11px] leading-relaxed text-muted">Questions about commission, refunds or payouts? Our host team replies on WhatsApp within minutes.</p>
              <a href="https://wa.me/2348000000000" target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 underline underline-offset-4"><Icon name="whatsapp" className="h-3.5 w-3.5" /> Chat with host support</a>
            </div>
          </div>
        </div>
      )}

      <p className="mt-8 text-center text-[10px] text-muted">
        Host dashboard demo · sample bookings, payouts and verification documents.
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
