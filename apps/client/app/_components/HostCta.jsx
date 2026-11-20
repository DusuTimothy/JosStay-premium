import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";

export function HostCta() {
  return (
    <section className="container-page pt-10 sm:pt-12">
      <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-line bg-white p-5 sm:flex-row sm:items-center sm:p-6">
        <div className="flex items-start gap-4">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-gold-100 text-gold-700">
            <Icon name="home" className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-display text-[17px] font-bold text-ink">
              Have a place in Jos? Earn from it.
            </h3>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
              List your apartment, guest house or shortlet. We handle discovery,
              payments and support.
            </p>
          </div>
        </div>
        <Button href="/host" variant="secondary" iconRight="arrowRight" className="shrink-0">
          Start hosting
        </Button>
      </div>
      <p className="mt-6 text-center text-[11px] text-muted">
        Listings are reviewed for quality and safety. Pricing and availability are confirmed before payment.
      </p>
    </section>
  );
}
