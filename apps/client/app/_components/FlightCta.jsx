import { Badge } from "@/components/ui/Badge";

export function FlightCta() {
  return (
    <section className="container-page pt-12 sm:pt-16">
      <div className="rounded-xl bg-plum-50 px-6 py-8 sm:px-9 sm:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="eyebrow-plain border-b border-plum-200 pb-1">
              Optional travel extra
            </span>
            <h2 className="mt-4 font-display text-[26px] font-bold leading-tight tracking-tightest text-ink sm:text-[32px]">
              Flight + stay, coming soon
            </h2>
            <p className="mt-2 text-[14px] text-muted">
              Flight booking isn&apos;t available yet. You can book your stay now and we&apos;ll add flight bundles when ready.
            </p>
          </div>
          <Badge tone="gold" icon="sparkles" className="shrink-0 self-start sm:self-center">Coming soon</Badge>
        </div>
      </div>
    </section>
  );
}
