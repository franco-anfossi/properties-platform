import type { PropertyResult } from "./types";

// El HTML server-rendered de Portal Inmobiliario embebe cada propiedad como un objeto JSON
// con la forma {"id":"POLYCARD","state":"VISIBLE","polycard":{…}}. No hay un contenedor único
// estable, así que localizamos cada marcador y extraemos el objeto con un escáner de llaves
// balanceadas (consciente de strings). Es robusto a cambios de layout: si un bloque no parsea,
// se descarta sin romper el resto.

const POLYCARD_MARKER = '{"id":"POLYCARD"';
const MLSTATIC_BASE = "https://http2.mlstatic.com/D_NQ_NP_";

interface PolycardComponent {
  id?: string;
  title?: { text?: string };
  price?: {
    current_price?: { value?: number; currency?: string };
  };
}

interface Polycard {
  metadata?: { id?: string; url?: string };
  pictures?: { pictures?: Array<{ id?: string }> };
  components?: PolycardComponent[];
}

interface PolycardEnvelope {
  polycard?: Polycard;
}

/**
 * Extrae el substring de un objeto JSON que empieza en `start` (donde hay un `{`), respetando
 * strings y escapes, hasta cerrar la llave. Devuelve `null` si nunca se cierra (HTML truncado).
 */
function extractBalancedObject(html: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (c === "\\") {
      escaped = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return html.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * ¿El HTML contiene al menos un bloque polycard? Sirve para distinguir una página sin resultados
 * (sin marcadores → `empty`) de una cuyo formato cambió (hay marcadores pero no se pudo parsear
 * ninguno → `error`).
 */
export function hasPolycardMarker(html: string): boolean {
  return html.includes(POLYCARD_MARKER);
}

/** Localiza y parsea todos los envelopes polycard presentes en el HTML. Bloques rotos se omiten. */
export function extractPolycards(html: string): Polycard[] {
  const cards: Polycard[] = [];
  let searchFrom = 0;
  for (;;) {
    const markerAt = html.indexOf(POLYCARD_MARKER, searchFrom);
    if (markerAt < 0) break;
    searchFrom = markerAt + 1;
    const raw = extractBalancedObject(html, markerAt);
    if (!raw) continue;
    let envelope: PolycardEnvelope;
    try {
      envelope = JSON.parse(raw) as PolycardEnvelope;
    } catch {
      continue; // el portal cambió el formato / bloque truncado → se ignora
    }
    if (envelope.polycard) cards.push(envelope.polycard);
  }
  return cards;
}

function findComponent(
  card: Polycard,
  id: string,
): PolycardComponent | undefined {
  return card.components?.find((c) => c.id === id);
}

/** CLF es la Unidad de Fomento (UF) en la nomenclatura de MercadoLibre; CLP es el peso. */
function currencyLabel(currency: string | undefined): string | null {
  if (currency === "CLF") return "UF";
  if (currency === "CLP") return "$";
  return currency ?? null;
}

/** Formatea el precio al estilo chileno: separador de miles con punto (UF 4.957 / $350.000.000). */
function formatPrice(
  value: number | undefined,
  currency: string | undefined,
): { price: string | null; currency: string | null } {
  const label = currencyLabel(currency);
  if (value === undefined || value === null || label === null) {
    return { price: null, currency: label };
  }
  const grouped = new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: 0,
  }).format(value);
  const price = label === "$" ? `$${grouped}` : `${label} ${grouped}`;
  return { price, currency: label };
}

function imageUrlFrom(card: Polycard): string | null {
  const pictureId = card.pictures?.pictures?.[0]?.id;
  if (!pictureId) return null;
  // -O es un thumbnail liviano; ML sirve la imagen sólo con el id (verificado HTTP 200).
  return `${MLSTATIC_BASE}${pictureId}-O.webp`;
}

/** Normaliza la URL: los permalinks vienen relativos sin scheme; se antepone https://. */
function normalizeUrl(url: string | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://${url}`;
}

/** Un permalink real (…/MLC-… _JM) es preferible a un redirect de anuncio (click1…). */
function isAdTrackingUrl(url: string | null): boolean {
  return url !== null && url.includes("click1.portalinmobiliario.com");
}

function toPropertyResult(card: Polycard): PropertyResult | null {
  const externalId = card.metadata?.id;
  const title = findComponent(card, "title")?.title?.text;
  if (!externalId || !title) return null; // sin id o título no es una propiedad utilizable

  const currentPrice = findComponent(card, "price")?.price?.current_price;
  const { price, currency } = formatPrice(
    currentPrice?.value,
    currentPrice?.currency,
  );

  return {
    externalId,
    title,
    price,
    currency,
    imageUrl: imageUrlFrom(card),
    url: normalizeUrl(card.metadata?.url) ?? "",
  };
}

/**
 * Convierte el HTML de una página de resultados en `PropertyResult[]` normalizados y deduplicados
 * por `externalId`. Ante duplicados prefiere el permalink real sobre el redirect de anuncio.
 * Función pura: no hace red ni persiste nada.
 */
export function parsePolycards(html: string): PropertyResult[] {
  const byId = new Map<string, PropertyResult>();
  for (const card of extractPolycards(html)) {
    const result = toPropertyResult(card);
    if (!result) continue;
    const existing = byId.get(result.externalId);
    if (!existing) {
      byId.set(result.externalId, result);
      continue;
    }
    // Ya vimos esta publicación: reemplazamos sólo si mejora la URL (permalink > anuncio).
    if (isAdTrackingUrl(existing.url) && !isAdTrackingUrl(result.url)) {
      byId.set(result.externalId, result);
    }
  }
  return [...byId.values()];
}
