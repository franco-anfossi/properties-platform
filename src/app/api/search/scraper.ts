import { searchProperties } from "@/lib/scraper/portal-inmobiliario";
import type { SearchOutcome, SearchParams } from "@/lib/scraper/types";
// TEMP-MOCK: import a borrar cuando el scraper real esté implementado y mergeado.
import { mockSearchOutcome } from "./_mock-scraper";

/**
 * Adaptador único que usa la API route para scrapear.
 *
 * Programa contra la interfaz `searchProperties(params): Promise<SearchOutcome>`.
 * Mientras el módulo real es un stub Parte-0 que lanza, cae al mock local para no
 * bloquear el desarrollo de este stream. Cuando el scraper real se mergee:
 *   1. `searchProperties` devolverá un SearchOutcome real (no lanza) → se usa tal cual.
 *   2. Borrar `_mock-scraper.ts` y este bloque `try/catch` (buscar `TEMP-MOCK`).
 */
export async function runScrape(params: SearchParams): Promise<SearchOutcome> {
  try {
    return await searchProperties(params);
  } catch {
    // TEMP-MOCK: el scraper real todavía lanza (stub). Fallback a fixtures.
    return mockSearchOutcome(params);
  }
}
