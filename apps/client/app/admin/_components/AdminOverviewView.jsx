"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useAuth, useBooking, useToast } from "@/components/providers";
import { EmptyState, LoadingResults } from "@/components/shared/states";
import { AdminNav } from "./AdminNav";

const cards = [
  {
    href: "/account/admin/reviews",
    icon: "shield",
    title: "Listing reviews",
    text: "Review host submissions, verify documents/photos, and approve, reject, or suspend listings.",
  },
  {
    href: "/account/admin/refunds",
    icon: "wallet",
    title: "Refund review",
    text: "Review payments flagged for manual refund attention and mark them resolved after checking Paystack.",
  },
];

const accountShortcuts = [
  { href: "/bookings", icon: "calendar", title: "My bookings", text: "View and manage your stays in Jos." },
  { href: "/host/dashboard", icon: "home", title: "Host dashboard", text: "Manage listings, calendar and payouts." },
  { href: "/bundle", icon: "plane", title: "Flight + stay", text: "Coming soon — flight booking will be available later." },
  { href: "/help", icon: "whatsapp", title: "Help centre", text: "Answers, policies and support." },
];

export function AdminOverviewView() {
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();
  const { bookings } = useBooking();
  const [ready, setReady] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [resending, setResending] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await auth.logout();
      toast("Signed out", "default");
    } finally {
      setSigningOut(false);
    }
  };

  const resendVerification = async () => {
    if (resending || !auth.user?.email) return;
    setResending(true);
    try {
      await auth.requestEmailVerification(auth.user.email);
      toast("If your account needs verification, we sent a new link.", "success");
    } catch (error) {
      toast(error?.message || "Could not send verification email", "error");
    } finally {
      setResending(false);
    }
  };

  useEffect(() => {
    if (auth.isLoading) return;
    if (!auth.isAuthenticated) {
      router.push("/account");
      return;
    }
    setReady(true);
  }, [auth.isLoading, auth.isAuthenticated, router]);

  const upcoming = bookings.filter((b) => b.status === "upcoming").length;

  if (auth.isLoading || !ready) {
    return <div className="container-page py-10"><LoadingResults count={2} /></div>;
  }

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="eyebrow">Admin</span>
          <h1 className="mt-3 font-display text-[32px] font-bold leading-none tracking-tight text-ink sm:text-[40px]">Admin dashboard</h1>
          <p className="mt-2 text-sm text-muted">Manage listing reviews and manual refund review from one place.</p>
          <p className="mt-1 text-[11px] text-muted">{auth.user?.email || ""}</p>
          <AdminNav />
        </div>
        <Button variant="secondary" size="sm" onClick={signOut} loading={signingOut}>Sign out</Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <Link key={card.href} href={card.href} className="group rounded-xl border border-line bg-white p-5 transition hover:border-plum-200 hover:shadow-sm">
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-plum-50 text-plum-700">
                <Icon name={card.icon} className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold text-ink">{card.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">{card.text}</p>
                <span className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-plum-700">
                  Open <Icon name="arrowRight" className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-line bg-canvas px-4 py-3 text-[12px] text-muted">
        Admin actions affect live data. Refunds are tracked here for manual review only — JosStay does not automatically issue Paystack refunds.
      </div>

      <section className="mt-8 rounded-xl border border-line bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">My account</p>
            <h2 className="mt-2 font-display text-[24px] font-bold tracking-tight text-ink">Account &amp; bookings</h2>
            <p className="mt-1 text-sm text-muted">Access your normal account actions without leaving the admin dashboard.</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge tone="purple" className="capitalize">{auth.user?.role || "admin"}</Badge>
            {auth.user?.emailVerified ? <Badge tone="green">Email verified</Badge> : <Badge tone="amber">Email not verified</Badge>}
          </div>
        </div>

        {!auth.user?.emailVerified && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3 text-[12px] text-amber-900">
            <p className="font-semibold">Verify your email address</p>
            <p className="mt-1 text-amber-800">We sent a verification link when you created your account. Check your inbox and spam folder.</p>
            <button
              type="button"
              className="mt-2 font-semibold text-plum-700 underline decoration-plum-300 underline-offset-4 disabled:opacity-60"
              disabled={resending}
              onClick={resendVerification}
            >
              Resend verification email
            </button>
          </div>
        )}

        <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
          {[
            { label: "Upcoming stays", value: upcoming },
            { label: "Bookings in view", value: bookings.length },
            { label: "Currency", value: "NGN / USD" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-lg border border-line bg-canvas px-3.5 py-3">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.13em] text-muted">{stat.label}</p>
              <p className="mt-1 font-display text-[18px] font-bold text-ink">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 divide-y divide-line border-t border-line">
          {accountShortcuts.map((item) => (
            <Link key={item.href} href={item.href} className="group flex items-center gap-3.5 py-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-plum-50 text-plum-700">
                <Icon name={item.icon} className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] font-semibold text-ink">{item.title}</span>
                <span className="mt-0.5 block text-[11.5px] text-muted">{item.text}</span>
              </span>
              <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-plum-700" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
