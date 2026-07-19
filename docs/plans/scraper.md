# Stream: Scraper de Portal Inmobiliario (HTTP directo)

**Fecha:** 2026-07-19 · **Dueño:** `src/lib/scraper/**` · **Contrato:** `src/lib/scraper/types.ts`

## Spec breve

Implementar `searchProperties(params): Promise<SearchOutcome>` para obtener propiedades **en vivo**
de Portal Inmobiliario por **HTTP directo** (sin navegador headless). Función pura y bien tipada:
es el contrato del que dependen los demás streams (UI, API, trazabilidad).

### Recon técnico (verificado hoy contra el portal real)

- `GET https://www.portalinmobiliario.com/venta/departamento/<comuna>-metropolitana` → **HTTP 200**,
  ~1.38 MB, ~1.3 s, **sin bloqueo anti-bot**.
- La data viene embebida en el HTML como bloques JSON `{"id":"POLYCARD","state":"VISIBLE","polycard":{…}}`.
  Una búsqueda trae ~150 bloques que corresponden a ~48 publicaciones **únicas** (cada publicación
  se repite ~3× por distintos layouts). → **dedup por `metadata.id`**.
- Campos por card:
  - `polycard.metadata.id` → `externalId` (ej. `MLC3384619788`).
  - `polycard.metadata.url` → URL original. Publicaciones normales: **relativa sin scheme**
    (`portalinmobiliario.com/MLC-…-_JM`); anuncios (`is_pad:"true"`) traen un redirect `https://click1…`.
    Normalizar: si no empieza con `http`, prefijar `https://`.
  - `polycard.components[]`: `{id:"title"}.title.text`, `{id:"price"}.price.current_price {value, currency}`.
    `currency`: `CLF` → UF, `CLP` → $ (peso). Formato display estilo chileno con separador de miles `.`.
  - `polycard.pictures.pictures[0].id` → imagen. URL construible:
    `https://http2.mlstatic.com/D_NQ_NP_<pictureId>-O.webp` (verificado HTTP 200 image/webp).
- Variantes de URL verificadas: `venta|arriendo` × `departamento|casa` × `<comuna>-metropolitana`
  responden 200. Sin sufijo de región → 301. → siempre agregar región (default `metropolitana`).

## Decisiones tomadas (autonomía)

1. **Extracción robusta, no regex frágil.** Se localiza cada marcador `{"id":"POLYCARD"` y se extrae
   el objeto con un **escáner de llaves balanceadas consciente de strings** (respeta `\"` y `{`/`}`
   dentro de strings). Luego `JSON.parse`. Un bloque que no parsea se **descarta** (no rompe el resto).
2. **Contrato preservado, extendido de forma aditiva.** `SearchParams` gana `operation` y `propertyType`
   opcionales (default `venta`/`departamento`); `query` (comuna/dirección) sigue siendo el único requerido.
   No rompe consumidores existentes.
3. **`externalId` = `metadata.id` crudo** (`MLC3384619788`, sin guion). Es el id canónico y estable;
   sirve de clave para el unique de `favorites`.
4. **Imagen por construcción**, no por segundo parse del HTML: `…/D_NQ_NP_<id>-O.webp`. `-O` es un
   thumbnail liviano. Si falta `pictures[0].id` → `imageUrl: null` (campo nullable en el contrato).
5. **Región por defecto `metropolitana`.** El desafío es Santiago/RM. `query` se _slugifica_
   (lowercase, sin acentos vía NFD, `ñ→n`, no-alfanumérico → `-`). Si el slug ya termina en una región
   conocida no se duplica el sufijo. Direcciones exactas son best-effort (el portal es fuzzy por
   ubicación); la comuna es el caso primario.
6. **Clasificación de `SearchOutcome.status`:**
   - `ok` — HTTP 200 y ≥1 propiedad parseada.
   - `empty` — HTTP 200 pero 0 propiedades (búsqueda sin resultados o página válida sin cards).
   - `blocked` — HTTP 403/429 (o señales de captcha/anti-bot).
   - `error` — timeout, red caída, HTTP 5xx, o el HTML cambió y no se pudo extraer nada de bloques
     presentes. **Nunca lanza**: siempre devuelve un `SearchOutcome` para que la plataforma no crashee.
7. **Fetch:** User-Agent de navegador, `AbortController` con timeout (default 15 s), **reintentos
   acotados** (2 reintentos con backoff) sólo para fallos de red / 5xx / timeout (no para 4xx).

## Arquitectura de archivos (todo bajo `src/lib/scraper/`)

- `types.ts` — contrato (extendido aditivamente).
- `slug.ts` — `slugify()` + `buildSearchUrl(params)`. Puro. Testeable.
- `parse.ts` — `extractPolycardBlocks(html)`, `parsePolycards(html): PropertyResult[]`,
  helpers de precio/imagen/url. Puro. Testeable con fixture offline.
- `fetch.ts` — `fetchSearchHtml(url, opts): Promise<{ httpStatus, html }>`; timeout + retries;
  errores tipados (`ScraperFetchError` con `kind: timeout|network|http`).
- `portal-inmobiliario.ts` — `searchProperties(params)`: orquesta build→fetch→parse→clasifica; mide
  `durationMs`; traduce todo a `SearchOutcome`. Inyección opcional de `fetchImpl` para tests.

## Tests (vitest)

- `slug.test.ts` — slugify (acentos, ñ, espacios) y buildSearchUrl (venta/arriendo, región, no-dup).
- `parse.test.ts` — contra fixture real compacto: cuenta única, campos, formato de precio (UF/$),
  imagen construida, normalización de URL; fixture vacío → `[]`; fixture malformado → `[]` sin lanzar.
- `portal-inmobiliario.test.ts` — con `fetchImpl` inyectado (fixtures): 200+cards→`ok`,
  200 sin cards→`empty`, 403→`blocked`, timeout→`error`. Verifica que **nunca lanza**.
- `portal-inmobiliario.live.test.ts` — **1 test de integración en vivo**, tolerante: si el portal
  no responde/ cambia, no falla el suite (skip/asserts laxos). Marcado y desactivable por env.

## Verificación de cierre

`npm run lint`, `npm run typecheck`, `npm run format:check`, `npm test` (unit) verdes. Integración en
vivo corrida manualmente. Sin tocar `schema.prisma`, migraciones, `layout.tsx` ni `globals.css`.
