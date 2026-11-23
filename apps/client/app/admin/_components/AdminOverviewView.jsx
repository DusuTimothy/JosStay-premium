"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useAuth, useToast } from "@/components/providers";
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

export function AdminOverviewView() {
  const router = useRouter();
  const auth = useAuth();
  const { toast } = useToast();
  const [ready, setReady] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await auth.logout();
      toast("Signed out", "default");
    } finally {
      setSigningOut(false);
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
    </div>
  );
}
