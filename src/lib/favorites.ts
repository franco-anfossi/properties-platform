import { prisma } from "@/lib/prisma";
import type { Favorite } from "@/generated/prisma/client";

// Helpers de lectura de favoritos (estado propio). Pensados como contrato para el stream de
// search: puede marcar resultados ya favoriteados sin hacer una query por resultado.

export type { Favorite };

// Snapshot mínimo que viaja desde la UI al hacer POST /api/favorites.
export interface FavoriteSnapshot {
  externalId: string;
  url: string;
  title: string;
  price?: string | null;
  currency?: string | null;
  imageUrl?: string | null;
}

// Favoritos del usuario, más recientes primero.
export function getFavorites(userId: string): Promise<Favorite[]> {
  return prisma.favorite.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

// Set de external_id favoriteados — para que search marque resultados en una sola query.
export async function getFavoriteIdSet(userId: string): Promise<Set<string>> {
  const rows = await prisma.favorite.findMany({
    where: { userId },
    select: { externalId: true },
  });
  return new Set(rows.map((r) => r.externalId));
}
