"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { useCurrency } from "@/components/providers";
import { InstallAppButton } from "@/components/pwa/InstallAppButton";
import { Logo } from "./Logo";

const nav = [
  { href: "/search", label: "Find a stay" },
  { href: "/search?type=hotel", label: "Hotels" },
  { href: "/search?type=shortlet", label: "Shortlets" },
  { href: "/search?type=airbnb", label: "Airbnb-style stays" },
  { href: "/bookings", label: "My bookings" },
  { href: "/host", label: "List your property" },
];

function CurrencyToggle({ className = "" }) {
  const { currency, toggle } = useCurrency();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch currency, currently ${currency}`}
      className={`inline-flex h-9 items-center gap-1 rounded-full border border-line bg-white px-2.5 text-[11px] font-semibold text-muted transition hover:border-plum-300 hover:text-plum-700 ${className}`}
    >
      <span className={currency === "NGN" ? "text-plum-700" : ""}>₦</span>
      <span className="text-line">/</span>
      <span className={currency === "USD" ? "text-plum-700" : ""}>$</span>
    </button>
  );
}

export function Header() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header className="sticky top-0 z-50 border-b border-line bg-white">
      <div className="container-page flex h-[72px] items-center justify-between gap-6 lg:h-[88px]">
        <Logo />

        <nav className="hidden items-center gap-6 xl:flex">
          {nav.map((item) => {
            const active =
              pathname === item.href.split("?")[0] &&
              (!item.href.includes("?") ||
                (typeof window !== "undefined" &&
                  window.location.search.includes(item.href.split("?")[1])));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap text-[14px] transition hover:text-plum-700 ${
                  active ? "font-semibold text-plum-700" : "font-medium text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 xl:flex">
          <CurrencyToggle />
          <InstallAppButton />
          <Link
            href="/account"
            className="inline-flex h-12 items-center gap-2 rounded-full border border-line px-5 text-[14px] font-medium text-ink transition hover:border-plum-300 hover:text-plum-700"
          >
            <Icon name="user" className="h-4 w-4" />
            My account
          </Link>
        </div>

        <div className="flex items-center gap-2 xl:hidden">
          <CurrencyToggle />
          <Link
            href="/account"
            className="grid h-10 w-10 place-items-center rounded-full border border-line text-ink"
            aria-label="My account"
          >
            <Icon name="user" className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="grid h-10 w-10 place-items-center rounded-full border border-line text-ink"
            aria-label="Open menu"
            aria-expanded={open}
          >
            <Icon name="menu" />
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-[60] xl:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink/40 animate-fade-in"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-x-0 top-0 rounded-b-2xl bg-white p-5 shadow-float animate-slide-up">
            <div className="mb-5 flex items-center justify-between">
              <Logo />
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-10 w-10 place-items-center rounded-full border border-line text-ink"
                aria-label="Close menu"
              >
                <Icon name="x" />
              </button>
            </div>
            <div className="divide-y divide-line/70 border-y border-line/70">
              {[...nav, { href: "/account", label: "My account" }].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center justify-between py-3.5 text-[15px] font-medium text-ink"
                >
                  {item.label}
                  <Icon name="chevronRight" className="h-4 w-4 text-muted" />
                </Link>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link
                href="/host"
                className="rounded-lg bg-gold-500 px-4 py-3 text-center text-sm font-semibold text-ink"
              >
                List your property
              </Link>
              <Link
                href="/help"
                className="rounded-lg border border-line px-4 py-3 text-center text-sm font-semibold text-ink"
              >
                Help centre
              </Link>
            </div>
            <InstallAppButton full size="md" className="mt-2" />
          </div>
        </div>
      )}
    </header>
  );
}
