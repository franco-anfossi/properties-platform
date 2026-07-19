"use client";

import { useState, useTransition } from "react";
import type { FavoriteSnapshot } from "@/lib/favorites";

// Botón de favorito reutilizable (corazón). Contrato para el stream de search y para /favorites.
// Estado optimista; llama a la API POST/DELETE según su estado actual; revierte en error.
// No hace router.refresh() por defecto para no re-disparar la búsqueda en la página de search.
export function FavoriteButton({
  property,
  initialFavorited = false,
  onChange,
  className,
}: {
  property: FavoriteSnapshot;
  initialFavorited?: boolean;
  onChange?: (favorited: boolean) => void;
  className?: string;
}) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState(false);

  function toggle() {
    const next = !favorited;
    setError(false);
    setFavorited(next); // optimista

    startTransition(async () => {
      try {
        const res = next
          ? await fetch("/api/favorites", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(property),
            })
          : await fetch("/api/favorites", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ externalId: property.externalId }),
            });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        onChange?.(next);
      } catch {
        setFavorited(!next); // revertir
        setError(true);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-pressed={favorited}
      aria-label={favorited ? "Quitar de favoritos" : "Agregar a favoritos"}
      title={
        error
          ? "No se pudo actualizar el favorito"
          : favorited
            ? "Quitar de favoritos"
            : "Agregar a favoritos"
      }
      className={
        className ??
        "inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white/90 text-lg shadow-sm transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900/90 dark:hover:bg-zinc-800"
      }
    >
      <span className={favorited ? "text-red-500" : "text-zinc-400"}>
        {favorited ? "♥" : "♡"}
      </span>
    </button>
  );
}
