import { Button } from "@/components/ui/Button";

export function FlightCta() {
  return (
    <section className="container-page pt-12 sm:pt-16">
      <div className="rounded-xl bg-plum-50 px-6 py-8 sm:px-9 sm:py-10">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <span className="eyebrow-plain border-b border-plum-200 pb-1">
              Optional travel extra
            </span>
            <h2 className="mt-4 font-display text-[26px] font-bold leading-tight tracking-tightest text-ink sm:text-[32px]">
              Need a flight to Jos too?
            </h2>
            <p className="mt-2 text-[14px] text-muted">
              Add a flight after choosing your stay and keep your trip details together.
            </p>
          </div>
          <Button
            href="/bundle"
            variant="secondary"
            size="lg"
            iconRight="send"
            className="shrink-0 !border-line bg-white"
          >
            Add a flight
          </Button>
        </div>
      </div>
    </section>
  );
}
