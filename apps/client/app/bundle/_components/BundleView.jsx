"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export function BundleView() {
  return (
    <div className="container-page pb-16 pt-6 sm:pt-9">
      <div className="mx-auto max-w-2xl rounded-xl border border-line bg-white p-6 sm:p-8">
        <Badge tone="gold" icon="sparkles">Coming soon</Badge>
        <span className="eyebrow mt-5 block">Optional travel extra</span>
        <h1 className="mt-4 font-display text-[36px] font-bold leading-[1.02] tracking-tightest text-ink sm:text-[50px]">
          Flight + stay
        </h1>
        <p className="mt-4 text-[14px] leading-relaxed text-muted sm:text-[15px]">
          Flight booking isn&apos;t available yet. We&apos;re working on it and will launch it when it&apos;s ready. For now, you can book your stay and arrange flights separately.
        </p>

        <div className="mt-6 rounded-xl border border-gold-200 bg-gold-50/60 p-4">
          <p className="text-sm font-semibold text-ink">What to expect</p>
          <ul className="mt-2 space-y-1.5 text-[13px] text-muted">
            <li className="flex items-start gap-2"><Icon name="checkCircle" className="mt-0.5 h-4 w-4 shrink-0 text-plum-600" /><span>Flight + stay booking in one flow</span></li>
            <li className="flex items-start gap-2"><Icon name="checkCircle" className="mt-0.5 h-4 w-4 shrink-0 text-plum-600" /><span>Clear pricing before payment</span></li>
            <li className="flex items-start gap-2"><Icon name="checkCircle" className="mt-0.5 h-4 w-4 shrink-0 text-plum-600" /><span>Available only after full launch readiness</span></li>
          </ul>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button href="/search" iconRight="arrowRight">Explore stays</Button>
          <Button href="/help" variant="secondary">Get help</Button>
        </div>

        <p className="mt-6 text-[12px] text-muted">
          Need help planning your trip now? <Link href="/help" className="font-semibold text-plum-700 underline underline-offset-4">Contact support</Link>.
        </p>
      </div>
    </div>
  );
}
