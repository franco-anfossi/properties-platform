import { searchProperties } from "@/lib/scraper/portal-inmobiliario";
import type { SearchOutcome, SearchParams } from "@/lib/scraper/types";

/**
 * Adaptador único que usa la API route para scrapear.
 *
 * `searchProperties` es una función pura de I/O que **nunca lanza**: siempre resuelve a un
 * `SearchOutcome` tipado (status ok/empty/blocked/error). La route usa ese status para registrar
 * el evento SCRAPE y degradar con elegancia. Ver src/lib/scraper.
 */
export async function runScrape(params: SearchParams): Promise<SearchOutcome> {
  return searchProperties(params);
}
