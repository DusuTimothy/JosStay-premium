import { Icon } from "@/components/ui/Icon";
import { Button } from "@/components/ui/Button";

export function EmptyState({
  title = "No stays match those filters",
  description = "Try widening your price range, removing an amenity, or searching all of Jos.",
  actionLabel = "Reset filters",
  onAction,
  icon = "search",
  children,
}) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-white px-6 py-16 text-center">
      <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-plum-50 text-plum-600">
        <Icon name={icon} className="h-6 w-6" />
      </span>
      <h3 className="mt-4 font-display text-xl font-bold text-ink">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
        {description}
      </p>
      {onAction && (
        <div className="mt-6 flex justify-center">
          <Button onClick={onAction}>{actionLabel}</Button>
        </div>
      )}
      {children}
    </div>
  );
}
