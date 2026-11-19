export function SkeletonCard() {
  return (
    <div>
      <div className="aspect-[16/10] w-full animate-pulse rounded-lg bg-gray-200/80" />
      <div className="mt-4 space-y-2.5">
        <div className="h-3 w-40 animate-pulse rounded bg-gray-200" />
        <div className="h-5 w-3/4 animate-pulse rounded bg-gray-200" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-gray-200" />
        <div className="h-5 w-24 animate-pulse rounded bg-gray-200" />
      </div>
    </div>
  );
}
