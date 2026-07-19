import { createClient } from "@/lib/supabase/server";
import {
  getUserTimeline,
  TRACEABILITY_SQL,
  DEMO_USER_ID,
} from "@/lib/traceability";
import type { TimelineSession } from "@/lib/traceability";
import { seedDemoJourney } from "./actions";

// Página de debug de trazabilidad. Demuestra en vivo que UNA SOLA query reconstruye el recorrido
// completo de un usuario (login → búsqueda → scraping → click → favorito).
//
// Resolución del usuario objetivo (mismo modelo que /api/traceability):
//   1. Sesión Supabase válida → propio recorrido.
//   2. ?userId=<uuid> + ?secret=CRON_SECRET → recorrido de cualquier usuario (para el evaluador).
//   3. Sin nada → usuario demo (permite operar antes de que exista el flujo de login).

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const dynamic = "force-dynamic";

async function resolveUserId(searchParams: {
  userId?: string;
  secret?: string;
}): Promise<{ userId: string; mode: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) return { userId: user.id, mode: "sesión" };

  const { userId, secret } = searchParams;
  const cronSecret = process.env.CRON_SECRET;
  if (userId && UUID_RE.test(userId) && cronSecret && secret === cronSecret) {
    return { userId, mode: "debug (secreto)" };
  }

  return { userId: DEMO_USER_ID, mode: "demo" };
}

export default async function TraceabilityDebugPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string; secret?: string }>;
}) {
  const params = await searchParams;
  const { userId, mode } = await resolveUserId(params);
  const timeline = await getUserTimeline(userId);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12 font-sans">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Trazabilidad de punta a punta
        </h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Reconstrucción del recorrido de un usuario con una sola query.
        </p>
      </header>

      <section className="mb-8 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="mb-2 text-xs font-medium tracking-wide text-zinc-500 uppercase">
          La query única
        </p>
        <pre className="overflow-x-auto text-sm text-zinc-800 dark:text-zinc-200">
          <code>{TRACEABILITY_SQL}</code>
        </pre>
        <p className="mt-3 text-xs text-zinc-500">
          userId: <code className="font-mono">{userId}</code> · modo: {mode} ·{" "}
          {timeline.events.length} eventos · {timeline.sessions.length}{" "}
          sesión(es)
        </p>
      </section>

      <form action={seedDemoJourney} className="mb-8">
        <button
          type="submit"
          className="rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-black dark:hover:bg-zinc-300"
        >
          Sembrar recorrido de ejemplo
        </button>
        <span className="ml-3 text-xs text-zinc-500">
          Genera login → búsqueda → scraping → click → favorito y recarga.
        </span>
      </form>

      {timeline.sessions.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Sin eventos todavía. Siembra un recorrido de ejemplo para verlo
          reconstruido.
        </p>
      ) : (
        timeline.sessions.map((session) => (
          <SessionBlock
            key={session.sessionId ?? "sin-sesion"}
            session={session}
          />
        ))
      )}
    </main>
  );
}

function SessionBlock({ session }: { session: TimelineSession }) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-baseline justify-between border-b border-zinc-200 pb-2 dark:border-zinc-800">
        <h2 className="font-mono text-xs text-zinc-500">
          sesión {session.sessionId ?? "(sin session_id)"}
        </h2>
        <span className="text-xs text-zinc-400">
          {new Date(session.startedAt).toLocaleString("es-CL")}
        </span>
      </div>
      <ol className="relative ml-3 border-l border-zinc-200 dark:border-zinc-800">
        {session.steps.map((step) => (
          <li key={step.id} className="mb-5 ml-6">
            <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-white text-sm ring-1 ring-zinc-200 dark:bg-black dark:ring-zinc-800">
              {step.icon}
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-mono text-[10px] tracking-wide text-zinc-400 uppercase">
                {step.type}
              </span>
              <time className="text-[11px] text-zinc-400">
                {new Date(step.at).toLocaleTimeString("es-CL")}
              </time>
            </div>
            <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
              {step.label}
            </p>
            {step.detail && (
              <p className="truncate text-xs text-zinc-500">{step.detail}</p>
            )}
            {step.correlationKey && (
              <p className="mt-0.5 font-mono text-[10px] text-zinc-400">
                ↳ {step.correlationKey}
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
