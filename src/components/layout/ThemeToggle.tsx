"use client";

import { cn } from "@/lib/cn";
import { SunIcon, MoonIcon } from "@/components/icons";

/**
 * Toggle claro/oscuro. Sin estado de React: el ícono correcto se muestra vía
 * la variante `dark:` (que depende de `data-theme`, fijado pre-paint por el
 * script inline del layout), así no hay mismatch de hidratación. El click
 * muta `data-theme` en <html> y persiste la preferencia en `localStorage`.
 */
export function ThemeToggle({ className }: { className?: string }) {
  function toggle() {
    const next =
      document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      // localStorage no disponible (modo privado): no bloquea el toggle.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Cambiar tema claro/oscuro"
      className={cn(
        "text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring flex size-10 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-2",
        className,
      )}
    >
      <MoonIcon className="size-5 dark:hidden" />
      <SunIcon className="hidden size-5 dark:block" />
    </button>
  );
}
