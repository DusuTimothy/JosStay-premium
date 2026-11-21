import Link from "next/link";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "./Logo";

const links = [
  { label: "Explore stays", href: "/search" },
  { label: "Flight + stay (coming soon)", href: "/bundle" },
  { label: "Manage booking", href: "/bookings" },
  { label: "List your property", href: "/host" },
  { label: "Help centre", href: "/help" },
];

export function Footer() {
  return (
    <footer className="mt-16 bg-plum-800 pb-24 text-white xl:pb-0">
      <div className="container-page py-12 sm:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.1fr_1.2fr_0.9fr] lg:gap-16">
          <div>
            <Logo tone="light" />
            <div className="mt-6 flex flex-wrap gap-2">
              <span className="rounded-md border border-white/15 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/70">
                Paystack secured
              </span>
              <span className="rounded-md border border-white/15 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-white/70">
                Verified stays
              </span>
            </div>
          </div>

          <p className="max-w-sm text-[15px] leading-relaxed text-white/80 lg:pt-2">
            Hotels, shortlets and local stays in Jos, made simpler for Nigerian
            travellers.
          </p>

          <nav className="space-y-3 lg:pt-1">
            {links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="block text-[14px] text-white/80 transition hover:text-gold-300"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/15 pt-6 text-[12px] text-white/55 sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 JosStay Premium · Built for Plateau State</p>
          <p className="inline-flex items-center gap-1.5">
            <Icon name="shield" className="h-3.5 w-3.5" />
            Prototype uses replaceable sample content
          </p>
        </div>
      </div>
    </footer>
  );
}
