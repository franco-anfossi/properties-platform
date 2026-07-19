import type { SearchParams } from "./types";

const PORTAL_ORIGIN = "https://www.portalinmobiliario.com";

// Región por defecto. El desafío es Santiago / Región Metropolitana; el portal exige el
// sufijo de región en el slug de ubicación (sin él responde 301).
const DEFAULT_REGION = "metropolitana";
const KNOWN_REGIONS = [DEFAULT_REGION];

/**
 * Normaliza texto libre (comuna o dirección) al slug que usa Portal Inmobiliario en su URL:
 * minúsculas, sin acentos (ñ → n), y no-alfanuméricos colapsados a un guion.
 */
export function slugify(input: string): string {
  return input
    .normalize("NFD") // separa acentos como marcas combinantes
    .replace(/[̀-ͯ]/g, "") // los elimina (á→a, ñ→n, é→e, …)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // cualquier otra cosa → guion
    .replace(/^-+|-+$/g, ""); // sin guiones al inicio/fin
}

/**
 * Mapea los parámetros de búsqueda a la URL del portal, replicando su buscador:
 *   {origin}/{operation}/{propertyType}/{querySlug}-{region}
 * Si el query ya trae la región, no se duplica.
 */
export function buildSearchUrl(params: SearchParams): string {
  const operation = params.operation ?? "venta";
  const propertyType = params.propertyType ?? "departamento";

  let locationSlug = slugify(params.query);
  const alreadyHasRegion = KNOWN_REGIONS.some(
    (region) => locationSlug === region || locationSlug.endsWith(`-${region}`),
  );
  if (!alreadyHasRegion) {
    locationSlug = `${locationSlug}-${DEFAULT_REGION}`;
  }

  return `${PORTAL_ORIGIN}/${operation}/${propertyType}/${locationSlug}`;
}
