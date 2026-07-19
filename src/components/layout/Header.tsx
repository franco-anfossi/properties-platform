"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { Logo } from "./Logo";
import { NavLinks } from "./NavLinks";
import { ThemeToggle } from "./ThemeToggle";
import { MenuIcon, CloseIcon } from "@/components/icons";

export interface HeaderProps {
  /** Área de sesión (rendered server-side por `SessionNav`). */
  sessionSlot?: React.ReactNode;
}

/**
 * Header sticky con navegación responsiva. En desktop muestra los links
 * inline; en móvil un menú desplegable. El estado de sesión llega como slot
 * pre-renderizado en el servidor (desacopla el shell del stream de auth).
 */
export function Header({ sessionSlot }: HeaderProps) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  // Cierra el menú móvil al cambiar de ruta, ajustando estado en render
  // (patrón "storing previous value" de React, en vez de un efecto).
  const [prevPath, setPrevPath] = React.useState(pathname);
  if (prevPath !== pathname) {
    setPrevPath(pathname);
    if (open) setOpen(false);
  }

  return (
    <header className="border-border bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Logo />
          <div className="hidden md:block">
            <NavLinks />
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <div className="hidden sm:block">{sessionSlot}</div>

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={open ? "Cerrar menú" : "Abrir menú"}
            aria-expanded={open}
            className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring flex size-10 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-2 md:hidden"
          >
            {open ? (
              <CloseIcon className="size-5" />
            ) : (
              <MenuIcon className="size-5" />
            )}
          </button>
        </div>
      </div>

      {/* Panel móvil */}
      <div
        className={cn(
          "border-border overflow-hidden md:hidden",
          open ? "border-t" : "max-h-0",
        )}
      >
        {open && (
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6">
            <NavLinks
              orientation="vertical"
              onNavigate={() => setOpen(false)}
            />
            <div className="border-border border-t pt-4 sm:hidden">
              {sessionSlot}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
