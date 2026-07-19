import Link from "next/link";
import { cn } from "@/lib/cn";
import { HomeIcon } from "@/components/icons";

/** Marca de la plataforma. Enlaza al inicio. */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "text-foreground focus-visible:ring-ring flex items-center gap-2 rounded-md font-semibold tracking-tight outline-none focus-visible:ring-2",
        className,
      )}
    >
      <span className="bg-primary text-primary-foreground flex size-8 items-center justify-center rounded-lg">
        <HomeIcon className="size-5" />
      </span>
      <span className="text-base">
        Portal<span className="text-primary">Prop</span>
      </span>
    </Link>
  );
}
