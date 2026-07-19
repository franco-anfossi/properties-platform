// Contrato del módulo de scraping. La UI y la API dependen SOLO de estos tipos,
// no de cómo se obtiene la data del portal (permite cambiar de portal sin tocar consumidores).

export interface PropertyResult {
  externalId: string; // id de la publicación en el portal (ej: MLC-1768620109)
  title: string;
  price: string | null; // texto de display (ej: "UF 6.500", "$350.000.000")
  currency: string | null; // "UF" | "CLP" | null
  imageUrl: string | null;
  url: string; // URL original en el portal (para el click)
}

export type Operation = "venta" | "arriendo";
export type PropertyType = "departamento" | "casa";

export interface SearchParams {
  query: string; // dirección o comuna
  operation?: Operation; // default: "venta"
  propertyType?: PropertyType; // default: "departamento"
  // Extensible a futuro: page, filtros de precio/superficie, etc.
}

export type ScrapeStatus = "ok" | "empty" | "blocked" | "error";

// Resultado del scraping incluyendo metadata para el evento SCRAPE (trazabilidad/robustez).
export interface SearchOutcome {
  status: ScrapeStatus;
  source: string;
  results: PropertyResult[];
  durationMs: number;
  httpStatus?: number;
  error?: string;
}
