import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SearchClient } from "./search-client";

// El scraping es siempre en vivo: nunca prerenderizar esta página.
export const dynamic = "force-dynamic";

/**
 * Página de búsqueda (protegida). El middleware ya bloquea `/search` sin sesión;
 * acá revalidamos en el server como defensa en profundidad antes de renderizar.
 */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ query?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Permite repetir una búsqueda desde el historial (/search?query=...).
  const { query } = await searchParams;
  const initialQuery = typeof query === "string" ? query : "";

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 sm:py-14">
      <header className="mb-8 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl dark:text-zinc-50">
          Buscar propiedades
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Resultados en vivo desde Portal Inmobiliario. Cada tarjeta enlaza a la
          publicación original.
        </p>
      </header>

      <SearchClient initialQuery={initialQuery} />
    </main>
  );
}
