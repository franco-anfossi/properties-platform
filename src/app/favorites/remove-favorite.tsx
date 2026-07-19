"use client";

import { useRouter } from "next/navigation";
import { FavoriteButton } from "@/components/favorite-button";
import type { FavoriteSnapshot } from "@/lib/favorites";

// Wrapper de /favorites: reutiliza FavoriteButton y, al quitar, refresca el server component
// para que la card desaparezca de la lista.
export function RemoveFavorite({ property }: { property: FavoriteSnapshot }) {
  const router = useRouter();
  return (
    <FavoriteButton
      property={property}
      initialFavorited
      onChange={(favorited) => {
        if (!favorited) router.refresh();
      }}
    />
  );
}
