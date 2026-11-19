"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/Icon";

export function Logo({ compact = false, tone = "default" }) {
  const light = tone === "light";
  return (
    <Link href="/" className="flex items-center gap-3" aria-label="JosStay home">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold-500 text-plum-900">
        <Icon name="bedLogo" className="h-6 w-6" strokeWidth={1.7} />
      </span>
      {!compact && (
        <span className="leading-none">
          <span
            className={`block font-display text-[22px] font-bold tracking-tight ${
              light ? "text-white" : "text-plum-700"
            }`}
          >
            JosStay
          </span>
          <span
            className={`mt-1.5 block border-t pt-1 text-[7.5px] font-semibold uppercase tracking-[0.2em] ${
              light ? "border-white/25 text-white/60" : "border-line text-muted"
            }`}
          >
            By JosStay Premium
          </span>
        </span>
      )}
    </Link>
  );
}
