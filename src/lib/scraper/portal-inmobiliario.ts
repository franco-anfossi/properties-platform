import { fetchSearchHtml, ScraperFetchError } from "./fetch";
import { hasPolycardMarker, parsePolycards } from "./parse";
import { buildSearchUrl } from "./slug";
import type { SearchOutcome, SearchParams } from "./types";

export const SOURCE = "portal-inmobiliario";

/**
 * Dependencias inyectables para tests (fetch simulado, sin timeouts reales). En producción se
 * usan los valores por defecto de `fetchSearchHtml`.
 */
export interface SearchDeps {
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  retries?: number;
}

/**
 * Scraping HTTP directo de Portal Inmobiliario.
 *
 * Por qué HTTP directo (no Playwright): el sondeo (ver DECISIONS.md §1) mostró que el portal
 * responde HTTP 200 sin bloqueo anti-bot y sirve la data de las propiedades embebida como JSON
 * "polycard" en el HTML server-rendered — título, permalink (URL original), precio e imagen. Se
 * obtiene todo con un fetch (~1.3 MB, ~1 s), sin navegador headless.
 *
 * Contrato: función pura de I/O (sólo lee el portal, no persiste nada) que **nunca lanza**.
 * Siempre resuelve a un `SearchOutcome` tipado para que la plataforma degrade con elegancia:
 *   - `ok`      → HTTP 200 con ≥1 propiedad.
 *   - `empty`   → HTTP 200 sin bloques polycard (búsqueda sin resultados).
 *   - `blocked` → HTTP 403/429 (bloqueo / rate limit).
 *   - `error`   → red caída, timeout, 5xx, 4xx no-bloqueo, o el HTML cambió (había bloques pero
 *                 ninguno parseó). El llamador registra el evento SCRAPE con este `status`.
 */
export async function searchProperties(
  params: SearchParams,
  deps: SearchDeps = {},
): Promise<SearchOutcome> {
  const startedAt = Date.now();
  const url = buildSearchUrl(params);
  const done = (outcome: Omit<SearchOutcome, "source" | "durationMs">) => ({
    ...outcome,
    source: SOURCE,
    durationMs: Date.now() - startedAt,
  });

  try {
    const { httpStatus, html } = await fetchSearchHtml(url, {
      fetchImpl: deps.fetchImpl,
      timeoutMs: deps.timeoutMs,
      retries: deps.retries,
    });

    if (httpStatus === 403 || httpStatus === 429) {
      return done({
        status: "blocked",
        results: [],
        httpStatus,
        error: `Portal respondió ${httpStatus} (bloqueo o rate limit)`,
      });
    }

    if (httpStatus !== 200) {
      return done({
        status: "error",
        results: [],
        httpStatus,
        error: `HTTP ${httpStatus} inesperado`,
      });
    }

    const results = parsePolycards(html);
    if (results.length > 0) {
      return done({ status: "ok", results, httpStatus });
    }

    // 200 sin propiedades: distinguir "sin resultados" de "el portal cambió el HTML".
    if (hasPolycardMarker(html)) {
      return done({
        status: "error",
        results: [],
        httpStatus,
        error:
          "Se encontraron bloques polycard pero ninguno pudo parsearse (¿cambió el formato?)",
      });
    }
    return done({ status: "empty", results: [], httpStatus });
  } catch (err) {
    // Sólo debería llegar aquí un ScraperFetchError (red/timeout). Cualquier otro también se
    // captura para cumplir la garantía de "nunca lanza".
    const message =
      err instanceof ScraperFetchError ? err.message : String(err);
    return done({ status: "error", results: [], error: message });
  }
}
