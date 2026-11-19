import { Suspense } from "react";
import { SearchView } from "./_components/SearchView";
import { LoadingResults } from "@/components/shared/states";

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="container-page pt-10">
          <LoadingResults count={4} />
        </div>
      }
    >
      <SearchView />
    </Suspense>
  );
}
