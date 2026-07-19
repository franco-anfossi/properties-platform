import { cn } from "@/lib/cn";
import { PropertyCardSkeleton } from "./PropertyCardSkeleton";

export interface PropertyGridProps {
  children?: React.ReactNode;
  /** Si es true, renderiza `skeletonCount` placeholders en lugar de children. */
  loading?: boolean;
  skeletonCount?: number;
  className?: string;
}

/**
 * Grilla responsiva para `PropertyCard`s. Con `loading` muestra skeletons
 * con el mismo layout (evita saltos al llegar la data).
 */
export function PropertyGrid({
  children,
  loading = false,
  skeletonCount = 8,
  className,
}: PropertyGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className,
      )}
    >
      {loading
        ? Array.from({ length: skeletonCount }).map((_, i) => (
            <PropertyCardSkeleton key={i} />
          ))
        : children}
    </div>
  );
}
