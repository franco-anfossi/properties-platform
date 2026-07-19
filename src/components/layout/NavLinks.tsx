"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { NAV_ITEMS } from "./nav-config";

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export interface NavLinksProps {
  orientation?: "horizontal" | "vertical";
  /** Callback al navegar (ej. cerrar el menú móvil). */
  onNavigate?: () => void;
  className?: string;
}

/** Links de navegación con estado activo derivado de la ruta actual. */
export function NavLinks({
  orientation = "horizontal",
  onNavigate,
  className,
}: NavLinksProps) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Principal"
      className={cn(
        orientation === "horizontal"
          ? "flex items-center gap-1"
          : "flex flex-col gap-1",
        className,
      )}
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon, exact }) => {
        const active = isActive(pathname, href, exact);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "focus-visible:ring-ring flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2",
              orientation === "vertical" && "w-full",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
