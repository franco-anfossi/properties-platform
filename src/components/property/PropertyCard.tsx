import { cn } from "@/lib/cn";
import { ExternalLinkIcon, ImageOffIcon, MapPinIcon } from "@/components/icons";

/**
 * Datos de presentación de una propiedad. Refleja el contrato del scraper
 * (`PropertyResult` en `src/lib/scraper/types.ts`) para que el stream de
 * búsqueda pueda pasar sus resultados sin transformarlos.
 */
export interface PropertyCardProps {
  externalId: string;
  title: string;
  price: string | null; // texto de display del portal (ej. "UF 6.500")
  currency?: string | null;
  imageUrl: string | null;
  url: string; // URL original en el portal (el click abre esto)
  /** Metadato opcional (ej. comuna) que el consumidor puede mostrar. */
  location?: string | null;
  /**
   * Slot para el toggle de favorito (lo rellena el stream de favoritos).
   * Se posiciona sobre la imagen y queda por ENCIMA del stretched-link, así
   * el consumidor no necesita preventDefault: el click no navega a la URL.
   */
  favoriteSlot?: React.ReactNode;
  className?: string;
}

/**
 * Card de propiedad clickeable. Toda la card enlaza a la URL original del
 * portal (patrón "stretched link" sin JS); el `favoriteSlot` se apila por
 * encima para capturar sus propios clicks.
 */
export function PropertyCard({
  title,
  price,
  imageUrl,
  url,
  location,
  favoriteSlot,
  className,
}: PropertyCardProps) {
  return (
    <article
      className={cn(
        "group border-border bg-card focus-within:ring-ring relative flex flex-col overflow-hidden rounded-[var(--radius-card)] border shadow-sm transition-shadow focus-within:ring-2 hover:shadow-md",
        className,
      )}
    >
      {/* Imagen */}
      <div className="bg-muted relative aspect-[4/3] overflow-hidden">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- imágenes de múltiples CDNs de MercadoLibre; ver docs/plans/ui-shell.md
          <img
            src={imageUrl}
            alt={title}
            loading="lazy"
            className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="text-muted-foreground flex size-full flex-col items-center justify-center gap-1">
            <ImageOffIcon className="size-8" />
            <span className="text-xs">Sin imagen</span>
          </div>
        )}

        {favoriteSlot && (
          <div className="absolute top-3 right-3 z-10">{favoriteSlot}</div>
        )}
      </div>

      {/* Contenido */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="text-card-foreground line-clamp-2 font-medium">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="outline-none after:absolute after:inset-0"
          >
            {title}
          </a>
        </h3>

        {location && (
          <p className="text-muted-foreground flex items-center gap-1 text-sm">
            <MapPinIcon className="size-4 shrink-0" />
            <span className="line-clamp-1">{location}</span>
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-1">
          <span className="text-accent text-lg font-semibold">
            {price ?? "Precio no publicado"}
          </span>
          <ExternalLinkIcon className="text-muted-foreground group-hover:text-foreground size-4 transition-colors" />
        </div>
      </div>
    </article>
  );
}
