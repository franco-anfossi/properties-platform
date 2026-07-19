import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

import { createClient } from "@/lib/supabase/server";
import { logEvent, EventType } from "@/lib/events";
import { runScrape } from "./scraper";
import type { SearchRequestBody, SearchResponse } from "./types";

/**
 * POST /api/search
 *
 * Recorrido (todo trazado en `events`, agrupado por `sessionId`):
 *   1. Gate de sesión → 401 JSON si no hay usuario (las páginas redirigen; las APIs no).
 *   2. Genera un `sessionId` por recorrido.
 *   3. logEvent SEARCH — intención del usuario (se registra siempre, aun si el scraping falla).
 *   4. Scraping en vivo vía el adaptador `runScrape`.
 *   5. logEvent SCRAPE — metadata de robustez (source, status, result_count, duration_ms, http_status).
 *
 * No persiste ninguna propiedad: solo eventos.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  let body: SearchRequestBody;
  try {
    body = (await request.json()) as SearchRequestBody;
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) {
    return NextResponse.json(
      { error: "La búsqueda no puede estar vacía" },
      { status: 400 },
    );
  }

  const sessionId = randomUUID();

  // Intención del usuario: se registra antes de scrapear.
  await logEvent({
    userId: user.id,
    sessionId,
    type: EventType.SEARCH,
    payload: { query },
  });

  const outcome = await runScrape({ query });

  // Metadata del scraping (sostiene el punto de robustez del desafío).
  await logEvent({
    userId: user.id,
    sessionId,
    type: EventType.SCRAPE,
    payload: {
      source: outcome.source,
      status: outcome.status,
      result_count: outcome.results.length,
      duration_ms: outcome.durationMs,
      http_status: outcome.httpStatus ?? null,
    },
  });

  const response: SearchResponse = {
    sessionId,
    status: outcome.status,
    source: outcome.source,
    count: outcome.results.length,
    results: outcome.results,
    error:
      outcome.status === "error" || outcome.status === "blocked"
        ? (outcome.error ??
          "No pudimos consultar el portal en este momento. Intenta de nuevo.")
        : undefined,
  };

  return NextResponse.json(response);
}
