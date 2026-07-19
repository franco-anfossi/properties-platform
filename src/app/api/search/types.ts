import type { PropertyResult, ScrapeStatus } from "@/lib/scraper/types";

// Contrato HTTP de POST /api/search. La UI depende SOLO de estos tipos.

export interface SearchRequestBody {
  query: string; // dirección o comuna
}

export interface SearchResponse {
  sessionId: string; // id del recorrido; los CLICK de esta lista lo reutilizan
  status: ScrapeStatus; // "ok" | "empty" | "blocked" | "error"
  source: string;
  count: number;
  results: PropertyResult[];
  error?: string; // mensaje amigable cuando status es "error" | "blocked"
}
