import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getFavorites } from "@/lib/favorites";
import { RemoveFavorite } from "./remove-favorite";

// Página de favoritos: estado propio, se muestra desde el snapshot mínimo (título/precio/imagen del
// momento en que se marcó) aunque la publicación ya no exista en el portal.
export const metadata = { title: "Favoritos · Propiedades" };

export default async function FavoritesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // El middleware ya protege la ruta; esto es defensa en profundidad + fuente del userId.
  if (!user) redirect("/login");

  const favorites = await getFavorites(user.id);

  return (
    <div className="min-h-full bg-zinc-50 dark:bg-black">
      <main className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Favoritos
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {favorites.length === 0
            ? "Aún no tienes favoritos."
            : `${favorites.length} ${favorites.length === 1 ? "propiedad guardada" : "propiedades guardadas"}.`}
        </p>

        {favorites.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-950">
            <p className="text-zinc-600 dark:text-zinc-400">
              Marca propiedades con el corazón desde la búsqueda para verlas
              aquí.
            </p>
            <Link
              href="/search"
              className="mt-4 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Ir a buscar
            </Link>
          </div>
        ) : (
          <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {favorites.map((fav) => (
              <li
                key={fav.id}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="relative aspect-[4/3] bg-zinc-100 dark:bg-zinc-900">
                  {fav.imageUrl ? (
                    // Imágenes remotas del portal (dominios arbitrarios): usamos <img> en vez de
                    // next/image para no configurar dominios de un catálogo efímero.
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={fav.imageUrl}
                      alt={fav.title}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-zinc-400">
                      Sin imagen
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <RemoveFavorite
                      property={{
                        externalId: fav.externalId,
                        url: fav.url,
                        title: fav.title,
                        price: fav.price,
                        currency: fav.currency,
                        imageUrl: fav.imageUrl,
                      }}
                    />
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-4">
                  <p className="line-clamp-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {fav.title}
                  </p>
                  {fav.price && (
                    <p className="mt-1 text-base font-semibold text-zinc-900 dark:text-zinc-100">
                      {fav.price}
                    </p>
                  )}
                  <a
                    href={fav.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto pt-3 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                  >
                    Ver publicación →
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
