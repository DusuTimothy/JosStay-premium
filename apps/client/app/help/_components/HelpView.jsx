"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/providers";
import { SUPPORT_PHONE_DISPLAY, SUPPORT_TEL_URL, supportWhatsAppUrl } from "@/lib/contact";

const CATEGORIES = ["All", "Booking", "Payments", "Cancellation", "Hosting", "Safety"];

const FAQS = [
  { category: "Booking", q: "How do I know a property is real?", a: "Verified listings carry a green “Verified property” badge. Our team checks the address, ownership documents and photos before a listing goes live. If anything ever doesn’t match, contact us on WhatsApp and we’ll make it right." },
  { category: "Booking", q: "Can I book without paying the full amount?", a: "This demo supports full payment by card, bank transfer or USSD. In production, selected stays will offer a part-payment option at checkout. The total is always shown before you pay — no hidden fees." },
  { category: "Booking", q: "How many guests can stay in a unit?", a: "Each room or unit lists its maximum capacity on the property page. Choose the correct number of guests at checkout; extra guests may be declined by the host or attract an additional fee." },
  { category: "Payments", q: "Which payment methods do you accept?", a: "Card (Visa, Mastercard, Verve), bank transfer and USSD, all processed securely through Paystack. Your card details are never stored by JosStay." },
  { category: "Payments", q: "When am I charged?", a: "You pay at checkout to confirm the booking. For eligible stays, the room is held immediately and the host is notified. Any refunds are returned to your original payment method." },
  { category: "Payments", q: "Do I get a receipt?", a: "Yes. A receipt with your booking reference is shown on the confirmation screen and emailed to you (via Brevo in production). You can also find it under My bookings." },
  { category: "Cancellation", q: "How do I cancel a booking?", a: "Open My bookings, find the stay, tap Cancel, and confirm. If you already paid, tap Request refund on the same booking to send a refund request to our team for review. The amount returned depends on the policy shown on the property page and in your confirmation." },
  { category: "Cancellation", q: "How do I request a refund?", a: "Open My bookings, find the paid booking, and tap Request refund. Choose a reason, add details if you like, and submit. You can track the status there and cancel the request while it is still pending. Our team reviews every request manually and sends approved refunds back to your original payment method through Paystack." },
  { category: "Cancellation", q: "What if the host cancels?", a: "You’ll receive a full refund and our team will help you find an alternative stay in Jos. Contact support on WhatsApp and we’ll prioritise your rebooking." },
  { category: "Hosting", q: "How do I become a host?", a: "Tap “Host your place”, create an account, then add a listing with photos and your verification documents. Once approved, your listing goes live and you can manage your calendar and prices from the host dashboard." },
  { category: "Hosting", q: "When do hosts get paid?", a: "Payouts settle to your Nigerian bank account after guest check-in, usually within one business day (T+1). The host dashboard shows gross, commission and net amounts for every booking." },
  { category: "Hosting", q: "What documents do I need to verify my listing?", a: "A government-issued ID (passport, NIN or driver’s licence) and proof of ownership or a letter of authority. Verification usually takes less than 48 hours." },
  { category: "Safety", q: "What safety measures are in place?", a: "We check property addresses, require valid ID at check-in, and encourage hosts to provide 24/7 security, backup power and safe water. Our support line is available around the clock for urgent issues." },
  { category: "Safety", q: "Is my payment protected?", a: "Payments are processed by Paystack with industry-standard encryption. JosStay does not store card details. Report anything suspicious to support immediately." },
];

const POLICIES = [
  { name: "Flexible", tone: "emerald", summary: "Plans change. Get most of your money back.", points: ["Full refund up to 48 hours before check-in", "50% refund within 48 hours", "No refund after check-in"] },
  { name: "Moderate", tone: "amber", summary: "A fair balance for hosts and guests.", points: ["Full refund up to 7 days before check-in", "50% refund up to 48 hours before", "No refund within 48 hours"] },
  { name: "Non-refundable", tone: "red", summary: "Lower rate, limited flexibility.", points: ["No refund on cancellation", "Date changes at the host’s discretion", "Best price for firm plans"] },
];

const toneClasses = {
  emerald: "border-emerald-200 bg-emerald-50/60 text-emerald-800",
  amber: "border-gold-300 bg-gold-100/60 text-plum-700",
  red: "border-red-200 bg-red-50/60 text-red-700",
};

export function HelpView() {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [open, setOpen] = useState(0);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return FAQS.filter((faq) => {
      const matchesCategory = category === "All" || faq.category === category;
      const matchesTerm = !term || faq.q.toLowerCase().includes(term) || faq.a.toLowerCase().includes(term);
      return matchesCategory && matchesTerm;
    });
  }, [query, category]);

  return (
    <div>
      <section className="border-b border-line bg-gradient-to-b from-plum-50 via-plum-50/40 to-canvas">
        <div className="container-page py-10 sm:py-14">
          <div className="mx-auto max-w-2xl text-center">
            <Badge tone="purple" icon="whatsapp">Support that actually answers</Badge>
            <h1 className="mt-5 font-display text-[36px] font-bold leading-none tracking-tightest text-ink sm:text-[46px]">How can we help?</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted sm:text-base">Answers about bookings, payments, cancellations and hosting — plus a real human on WhatsApp when you need one.</p>
            <div className="relative mt-5">
              <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} className="field !h-14 !rounded-xl !py-4 !pl-12 !pr-4 shadow-float" placeholder="Search help — e.g. refund, payment, verification" aria-label="Search frequently asked questions" />
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {CATEGORIES.map((cat) => (
                <button key={cat} type="button" onClick={() => setCategory(cat)} className={`chip ${category === cat ? "chip-active" : ""}`} aria-pressed={category === cat}>{cat}</button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="container-page grid gap-6 py-8 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[22px] font-bold tracking-tight text-ink">Frequently asked questions</h2>
            <span className="text-xs text-muted">{filtered.length} article{filtered.length === 1 ? "" : "s"}</span>
          </div>

          <div className="mt-4 space-y-2">
            {filtered.length === 0 ? (
              <div className="rounded-xl border border-dashed border-line bg-white p-8 text-center">
                <p className="text-sm font-semibold text-ink">No articles found</p>
                <p className="mt-1 text-xs text-muted">Try another keyword, or message us on WhatsApp.</p>
                <div className="mt-4 flex justify-center"><Button variant="secondary" size="sm" onClick={() => { setQuery(""); setCategory("All"); }}>Clear search</Button></div>
              </div>
            ) : (
              filtered.map((faq, index) => {
                const isOpen = open === index;
                return (
                  <div key={faq.q} className="overflow-hidden rounded-xl border border-line bg-white">
                    <button type="button" onClick={() => setOpen(isOpen ? -1 : index)} className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left" aria-expanded={isOpen}>
                      <span className="flex items-start gap-2.5">
                        <span className="mt-0.5 rounded bg-plum-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-plum-700">{faq.category}</span>
                        <span className="text-sm font-semibold text-ink">{faq.q}</span>
                      </span>
                      <Icon name="chevronDown" className={`mt-0.5 h-4 w-4 shrink-0 text-muted transition ${isOpen ? "rotate-180" : ""}`} />
                    </button>
                    {isOpen && <p className="border-t border-line px-4 py-3.5 text-xs leading-relaxed text-muted animate-fade-in">{faq.a}</p>}
                  </div>
                );
              })
            )}
          </div>

          <section id="cancellation" className="mt-10 scroll-mt-24">
            <h2 className="font-display text-[22px] font-bold tracking-tight text-ink">Cancellation policy</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">Each property shows its policy before you book. The actual policy for your stay is repeated on the checkout and confirmation screens.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {POLICIES.map((policy) => (
                <div key={policy.name} className={`rounded-xl border p-4 ${toneClasses[policy.tone]}`}>
                  <p className="text-sm font-bold">{policy.name}</p>
                  <p className="mt-0.5 text-[11px] opacity-80">{policy.summary}</p>
                  <ul className="mt-3 space-y-1.5">
                    {policy.points.map((point) => (
                      <li key={point} className="flex items-start gap-1.5 text-[11px] leading-relaxed"><Icon name="check" className="mt-0.5 h-3 w-3 shrink-0" />{point}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section id="hosts" className="mt-8 scroll-mt-24 rounded-xl border border-line bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-ink">Hosting with JosStay</h2>
                <p className="mt-0.5 text-xs text-muted">Listings, verification, payouts and guest management.</p>
              </div>
              <Button href="/host/dashboard" size="sm" variant="secondary" iconRight="arrowRight">Host dashboard</Button>
            </div>
          </section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white"><Icon name="whatsapp" className="h-5 w-5" /></span>
            <h2 className="mt-3 text-base font-bold text-emerald-900">Chat with us on WhatsApp</h2>
            <p className="mt-1 text-xs leading-relaxed text-emerald-800/80">Fastest way to reach a human. Available 8:00 AM – 10:00 PM WAT, with 24/7 cover for urgent stay issues.</p>
            <a href={supportWhatsAppUrl("Hi JosStay, I need help with my booking.")} target="_blank" rel="noreferrer" className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white transition hover:bg-emerald-700"><Icon name="whatsapp" className="h-4 w-4" />Start WhatsApp chat</a>
            <p className="mt-2 text-center text-[10px] text-emerald-800/60">Configured via NEXT_PUBLIC_SUPPORT_WHATSAPP_NUMBER</p>
          </div>

          <div className="rounded-xl border border-line bg-white p-5">
            <h2 className="text-sm font-bold text-ink">Other ways to reach us</h2>
            <div className="mt-3 space-y-3">
              <button type="button" onClick={() => toast("Email: support@josstay.demo (sample)", "default")} className="flex w-full items-start gap-2.5 text-left">
                <Icon name="mail" className="mt-0.5 h-4 w-4 text-plum-600" />
                <span><span className="block text-xs font-semibold text-ink">Email support</span><span className="block text-[11px] text-muted">support@josstay.demo</span></span>
              </button>
              <a href={SUPPORT_TEL_URL} className="flex items-start gap-2.5">
                <Icon name="phone" className="mt-0.5 h-4 w-4 text-plum-600" />
                <span><span className="block text-xs font-semibold text-ink">Call us</span><span className="block text-[11px] text-muted">{SUPPORT_PHONE_DISPLAY}</span></span>
              </a>
              <Link href="/bookings" className="flex items-start gap-2.5">
                <Icon name="calendar" className="mt-0.5 h-4 w-4 text-plum-600" />
                <span><span className="block text-xs font-semibold text-ink">Manage a booking</span><span className="block text-[11px] text-muted">Cancel, rebook or view receipt</span></span>
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-line bg-white p-5">
            <h2 className="text-sm font-bold text-ink">Popular actions</h2>
            <div className="mt-2 divide-y divide-line">
              {[
                { label: "Find a stay in Jos", href: "/search" },
                { label: "Flight + stay bundle (coming soon)", href: "/bundle" },
                { label: "Become a host", href: "/host" },
                { label: "View cancellation policy", href: "#cancellation" },
              ].map((item) => (
                <Link key={item.label} href={item.href} className="flex items-center justify-between py-2.5 text-xs font-medium text-ink hover:text-plum-700">
                  {item.label}
                  <Icon name="chevronRight" className="h-3.5 w-3.5 text-muted" />
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
