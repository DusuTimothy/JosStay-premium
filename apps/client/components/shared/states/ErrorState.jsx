import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";

export function ErrorState({
  title = "Something went wrong",
  description = "We couldn't load these stays. Check your connection and try again.",
  onRetry,
}) {
  return (
    <div className="rounded-xl border border-red-100 bg-red-50/50 px-6 py-16 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-100 text-red-600">
        <Icon name="alert" className="h-6 w-6" />
      </span>
      <h3 className="mt-4 font-display text-xl font-bold text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        {description}
      </p>
      <div className="mt-6 flex justify-center">
        <Button icon="refresh" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}
