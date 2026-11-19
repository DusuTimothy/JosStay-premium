"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/Icon";

export function MobileTabBar() {
  const pathname = usePathname();
  const hidden = ["/property", "/checkout", "/confirmation", "/host"].some((p) =>
    pathname.startsWith(p)
  );
  if (hidden) return null;

  const tabs = [
    { href: "/", label: "Home", icon: "home" },
    { href: "/search", label: "Search", icon: "search" },
    { href: "/bookings", label: "Trips", icon: "calendar" },
    { href: "/help", label: "Help", icon: "whatsapp" },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 backdrop-blur xl:hidden">
      <div className="mx-auto flex max-w-md items-stretch justify-around px-2 pb-[max(env(safe-area-inset-bottom),0.35rem)] pt-1.5">
        {tabs.map((tab) => {
          const active =
            tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex min-w-[64px] flex-1 flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 text-[10px] font-semibold transition ${
                active ? "text-plum-700" : "text-muted"
              }`}
            >
              <span
                className={`grid h-8 w-10 place-items-center rounded-full ${
                  active ? "bg-plum-50" : ""
                }`}
              >
                <Icon name={tab.icon} className="h-5 w-5" />
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
