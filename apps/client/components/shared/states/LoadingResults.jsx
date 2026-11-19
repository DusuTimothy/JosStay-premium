import { SkeletonCard } from "./SkeletonCard";

export function LoadingResults({ count = 4 }) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2 text-sm text-muted">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-plum-500 border-t-transparent" />
        Finding the best stays in Jos…
      </div>
      <div className="grid gap-x-6 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
