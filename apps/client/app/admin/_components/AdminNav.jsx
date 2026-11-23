"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/reviews", label: "Listing reviews" },
  { href: "/admin/refunds", label: "Refund review" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="mt-3 flex flex-wrap gap-2 text-[12px]" aria-label="Admin sections">
      {items.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={
              active
                ? "rounded-full border border-plum-200 bg-plum-50 px-3 py-1.5 font-semibold text-plum-700"
                : "rounded-full border border-line px-3 py-1.5 font-semibold text-muted hover:text-ink"
            }
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
