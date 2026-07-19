"use client";

import { useState } from "react";
import type { PropertyResult } from "@/lib/scraper/types";
import { FavoriteButton } from "@/components/favorite-button";

interface PropertyCardProps {
  property: PropertyResult;
  sessionId: string | null;
  /** Si el usuario ya tiene esta propiedad en favoritos (estado inicial del corazón). */
  initialFavorited?: boolean;
}

/**
 * Tarjeta de un resultado. El título/precio/imagen son efímeros (del portal) — NO se
 * persisten aquí; solo se muestran. Al clickear se registra un evento CLICK (fire-and-forget,
 * `keepalive`) y se abre la URL ORIGINAL del portal en una pestaña nueva. El tracking no
 * bloquea la navegación: si `/api/click` falla o tarda, la pestaña abre igual.
 */
export function PropertyCard({
  property,
  sessionId,
  initialFavorited = false,
}: PropertyCardProps) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = property.imageUrl && !imgFailed;

  function trackClick() {
    // No await: el link abre en una pestaña nueva; el tracking viaja en paralelo.
    void fetch("/api/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        externalId: property.externalId,
        url: property.url,
        sessionId,
      }),
    }).catch(() => {
      // Trazabilidad best-effort: un fallo de tracking nunca rompe la UX.
    });
  }

  return (
    <div className="relative">
      <a
        href={property.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={trackClick}
        className="group flex flex-col overflow-hidden rounded-xl border border-black/[.08] bg-white shadow-sm transition-shadow hover:shadow-md dark:border-white/[.12] dark:bg-zinc-900"
      >
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
          {showImage ? (
            // Imágenes de dominios arbitrarios del portal; next/image exigiría
            // configurar remotePatterns por dominio (fuera del alcance de este stream).
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={property.imageUrl!}
              alt={property.title}
              loading="lazy"
              onError={() => setImgFailed(true)}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-zinc-400 dark:text-zinc-600">
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <path d="M3 9.5 12 3l9 6.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V9.5Z" />
              </svg>
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-4">
          <h3 className="line-clamp-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
            {property.title}
          </h3>
          <div className="mt-auto flex items-center justify-between pt-1">
            <span className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
              {property.price ?? "Precio a consultar"}
            </span>
            <span className="text-xs font-medium text-blue-600 opacity-0 transition-opacity group-hover:opacity-100 dark:text-blue-400">
              Ver en el portal →
            </span>
          </div>
        </div>
      </a>
      <div className="absolute top-3 right-3 z-10">
        <FavoriteButton
          property={{
            externalId: property.externalId,
            url: property.url,
            title: property.title,
            price: property.price,
            currency: property.currency,
            imageUrl: property.imageUrl,
          }}
          initialFavorited={initialFavorited}
        />
      </div>
    </div>
  );
}
