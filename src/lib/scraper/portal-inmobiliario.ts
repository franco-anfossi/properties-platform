import type { SearchOutcome, SearchParams } from "./types";

export const SOURCE = "portal-inmobiliario";

/**
 * Scraping HTTP directo de Portal Inmobiliario.
 *
 * Por qué HTTP directo (no Playwright): el sondeo (ver DECISIONS.md) mostró que el portal
 * responde HTTP 200 sin bloqueo anti-bot y sirve la data de las propiedades embebida como
 * JSON "polycard" en el HTML server-rendered — título, permalink (URL original), precio e
 * imagen. Se obtiene todo con un fetch (~1.3 MB, ~1 s), sin navegador headless.
 *
 * STUB (Parte 0): la implementación real (fetch → extracción del JSON polycard →
 * normalización a PropertyResult → manejo de errores tipados) llega en el stream de scraping.
 */
export async function searchProperties(
  _params: SearchParams,
): Promise<SearchOutcome> {
  throw new Error("searchProperties: no implementado todavía (stub Parte 0)");
}
