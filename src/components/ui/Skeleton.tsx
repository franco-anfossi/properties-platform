import { cn } from "@/lib/cn";

/**
 * Bloque de carga. Usa un shimmer sutil sobre `bg-muted`.
 * Componer con clases de tamaño/redondeo: `<Skeleton className="h-4 w-32" />`.
 */
export function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "bg-muted relative overflow-hidden rounded-md",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.5s_infinite]",
        "after:bg-gradient-to-r after:from-transparent after:via-black/5 after:to-transparent",
        "dark:after:via-white/10",
        className,
      )}
      aria-hidden="true"
      {...props}
    />
  );
}
