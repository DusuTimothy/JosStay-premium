import Link from "next/link";
import { addDays, toIso } from "@josstay/shared";
import { SearchBar } from "@/components/shared/SearchBar";
import { Icon } from "@/components/ui/Icon";

const today = toIso(new Date());

const quickLinks = ["Rayfield", "Jos North", "Jos South", "Bukuru"];

export function HomeHero() {
  return (
    <section className="relative isolate overflow-hidden bg-[#170D24]">
      <img
        src="https://images.pexels.com/photos/6077368/pexels-photo-6077368.jpeg?auto=compress&cs=tinysrgb&w=2400"
        alt="Modern, light-filled apartment interior"
        fetchPriority="high"
        className="absolute inset-0 h-full w-full object-cover object-[center_60%] brightness-[0.82] saturate-[1.05] contrast-[1.08]"
      />
      <div className="absolute inset-0 hero-scrim" aria-hidden="true" />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-32 top-1/4 h-[28rem] w-[28rem] rounded-full bg-gold-400/10 blur-[120px]"
      />

      <div className="container-page relative flex min-h-[660px] flex-col justify-center pb-16 pt-14 sm:min-h-[720px] sm:pb-20 sm:pt-20 lg:min-h-[780px] lg:pb-24 lg:pt-24">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-[#170D24]/70 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] text-white backdrop-blur-md">
            <span className="h-1.5 w-1.5 rounded-full bg-gold-400 shadow-[0_0_12px_rgba(229,192,92,.9)]" />
            Jos, Plateau State
          </span>
        </div>

        <h1 className="mt-7 max-w-5xl font-display text-[clamp(3.4rem,8.6vw,7rem)] font-bold leading-[0.88] tracking-tightest text-white text-balance">
          Stay well.
          <br />
          <span className="relative inline-block text-[#F6C453]">
            Travel better.
            <svg
              aria-hidden="true"
              viewBox="0 0 420 16"
              className="absolute -bottom-2 left-1 h-[10px] w-[58%] text-gold-400/70 sm:-bottom-3"
              fill="none"
            >
              <path
                d="M3 12C96 4 220 3 417 8"
                stroke="currentColor"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
          </span>
        </h1>

        <p className="mt-7 max-w-xl text-[16px] font-medium leading-relaxed text-white/90 sm:text-[19px]">
          Handpicked hotels, apartments and shortlets in Jos — verified,
          transparently priced and ready to book in minutes.
        </p>

        <div className="mt-9 max-w-[1080px] sm:mt-11">
          <SearchBar
            initial={{
              checkIn: addDays(today, 7),
              checkOut: addDays(today, 10),
              guests: 2,
            }}
          />
        </div>

        <div className="mt-7 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5 text-[13px] font-semibold text-white/90">
            {[
              { icon: "shield", label: "Verified stays" },
              { icon: "checkCircle", label: "Free cancellation" },
              { icon: "clock", label: "24/7 local support" },
            ].map((item) => (
              <span key={item.label} className="inline-flex items-center gap-2">
                <Icon name={item.icon} className="h-4 w-4 text-gold-400" />
                {item.label}
              </span>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 text-[12px] font-semibold">
            <span className="mr-1 text-white/60">Popular:</span>
            {quickLinks.map((area) => (
              <Link
                key={area}
                href={`/search?destination=${encodeURIComponent(area)}`}
                className="rounded-full border border-white/20 bg-[#170D24]/30 px-3 py-1.5 text-white/90 backdrop-blur-sm transition hover:border-gold-400/60 hover:bg-white/10 hover:text-white"
              >
                {area}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
