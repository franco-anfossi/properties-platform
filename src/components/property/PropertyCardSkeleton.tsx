import { Skeleton } from "@/components/ui/Skeleton";

/** Placeholder de una `PropertyCard` mientras se scrapea. */
export function PropertyCardSkeleton() {
  return (
    <div className="border-border bg-card flex flex-col overflow-hidden rounded-[var(--radius-card)] border shadow-sm">
      <Skeleton className="aspect-[4/3] rounded-none" />
      <div className="flex flex-col gap-3 p-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="mt-1 flex items-center justify-between">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="size-4" />
        </div>
      </div>
    </div>
  );
}
