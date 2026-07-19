import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { EventType } from "@/lib/events";

// Historial de búsquedas. NO es una tabla propia: se lee del spine de trazabilidad
// (events WHERE type='SEARCH'), según DECISIONS.md §2. Ordenado por fecha, clickeable para re-buscar.
export const metadata = { title: "Historial · Propiedades" };

// El payload de un evento SEARCH es JSONB flexible: { query, comuna?, filters? }.
function readSearchPayload(payload: unknown): {
  query: string | null;
  comuna: string | null;
} {
  if (payload && typeof payload === "object") {
    const p = payload as Record<string, unknown>;
    return {
      query: typeof p.query === "string" ? p.query : null,
      comuna: typeof p.comuna === "string" ? p.comuna : null,
    };
  }
  return { query: null, comuna: null };
}

const dateFmt = new Intl.DateTimeFormat("es-CL", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Santiago",
});

export default async function HistoryPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const searches = await prisma.event.findMany({
    where: { userId: user.id, type: EventType.SEARCH },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="min-h-full bg-zinc-50 dark:bg-black">
      <main className="mx-auto max-w-3xl px-4 py-8">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Historial de búsquedas
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {searches.length === 0
            ? "Aún no has hecho búsquedas."
            : "Toca una búsqueda para repetirla."}
        </p>

        {searches.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center dark:border-zinc-700 dark:bg-zinc-950">
            <p className="text-zinc-600 dark:text-zinc-400">
              Tus búsquedas aparecerán aquí.
            </p>
            <Link
              href="/search"
              className="mt-4 inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Ir a buscar
            </Link>
          </div>
        ) : (
          <ul className="mt-6 divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
            {searches.map((event) => {
              const { query, comuna } = readSearchPayload(event.payload);
              const label = query ?? comuna ?? "(búsqueda sin término)";
              const canReplay = Boolean(query ?? comuna);
              const href = `/search?query=${encodeURIComponent(query ?? comuna ?? "")}`;

              const row = (
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {label}
                    </p>
                    {comuna && query && (
                      <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                        Comuna: {comuna}
                      </p>
                    )}
                  </div>
                  <time
                    dateTime={event.createdAt.toISOString()}
                    className="shrink-0 text-xs text-zinc-400"
                  >
                    {dateFmt.format(event.createdAt)}
                  </time>
                </div>
              );

              return (
                <li key={event.id}>
                  {canReplay ? (
                    <Link
                      href={href}
                      className="block transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
                    >
                      {row}
                    </Link>
                  ) : (
                    row
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
