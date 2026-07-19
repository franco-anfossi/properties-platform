# Stream Búsqueda — Spec + Plan de implementación

> Ruta pedida por el setup del stream. Diseño global en
> `docs/superpowers/specs/2026-07-19-plataforma-propiedades-scraping-design.md`;
> razonamiento en `DECISIONS.md`.

**Goal:** Página de búsqueda protegida por sesión que, dada una comuna/dirección, llama al scraper
y muestra los resultados (título + precio + imagen), cada uno clickeable a la URL original del
portal, dejando trazabilidad completa (`SEARCH → SCRAPE → CLICK`).

**Arquitectura:** UI de búsqueda (client component) que hace `POST /api/search`; la route obtiene
el user de la sesión (Supabase SSR), genera un `sessionId` por recorrido, registra `SEARCH` y
`SCRAPE` vía `logEvent`, y llama a `searchProperties()` del módulo scraper (contra su interfaz).
Cada click en un resultado dispara `POST /api/click` (registra `CLICK`) antes de abrir la URL
original en una pestaña nueva. **No se persiste ninguna propiedad — solo eventos.**

**Tech Stack:** Next.js 16 (App Router, route handlers), React 19, Tailwind v4, Supabase SSR,
Prisma 7 (vía `logEvent`).

## Global Constraints (del proyecto)

- **NO persistir propiedades.** Solo eventos (`events`) y, fuera de este stream, favoritos.
- **NO tocar** `prisma/schema.prisma` ni `prisma/migrations/` (schema congelado, DB compartida).
- Cambios acotados a: `src/app/search/**`, `src/app/api/search/**`, `src/app/api/click/**`.
  No tocar `layout.tsx` ni `globals.css` salvo de forma aditiva imprescindible.
- Importar el cliente Prisma generado desde `@/generated/prisma/client`.
- Todo evento pasa por `logEvent()` (`src/lib/events.ts`). Tipos de scraping en
  `src/lib/scraper/types.ts` — programar contra la interfaz, no contra la implementación.
- Antes de cerrar: `npm run lint`, `npm run typecheck`, `npm run format:check` en verde +
  verificación en runtime con `next-dev-loop`.

## Decisiones de diseño (este stream)

1. **`sessionId` por recorrido.** Se genera en el servidor **una vez por búsqueda** (`crypto.randomUUID()`)
   y se devuelve al cliente. Los `CLICK` de esa lista de resultados reutilizan ese `sessionId`, de modo
   que `events.session_id` agrupa un recorrido individual `SEARCH → SCRAPE → CLICK…`. Alternativa
   descartada: sessionId de larga vida en cookie (agrupa demasiado; el desafío pide reconstruir el
   recorrido, y un id por búsqueda lo hace más legible).

2. **Orden de eventos en la búsqueda:** primero `SEARCH` (intención del usuario, siempre se registra),
   luego se ejecuta el scraping, luego `SCRAPE` con su metadata (`source`, `status`, `result_count`,
   `duration_ms`, `http_status`). Así, aunque el scraping falle, queda registrada la intención.

3. **Auth en las API routes:** el middleware protege _páginas_ (`/search`) con redirect a `/login`;
   las **API routes hacen su propio gate** y devuelven **401 JSON** (no redirect) si no hay sesión —
   correcto para consumo `fetch`.

4. **Mock local del scraper (temporal).** El módulo real (`src/lib/scraper/portal-inmobiliario.ts`)
   es aún un stub Parte-0 que lanza. Para poder desarrollar y verificar el flow, un adaptador local
   (`src/app/api/search/scraper.ts`) llama al scraper real y, si lanza (stub no implementado),
   cae a un **mock claramente marcado** (`src/app/api/search/_mock-scraper.ts`). Cuando el scraper
   real se mergee, el adaptador empieza a devolver data real sin cambios; el archivo mock se borra
   y se quita el fallback. Marcado con `// TEMP-MOCK` para grep fácil.

5. **Click tracking sin bloquear la navegación.** El resultado es un `<a target="_blank">` a la URL
   original; el `CLICK` se registra con `fetch(..., { keepalive: true })` en `onClick` sin
   `preventDefault`, de modo que la pestaña nueva abre igual aunque el tracking tarde/falle
   (degradación elegante: la trazabilidad no debe romper la UX).

6. **Verificación:** no hay test runner en el repo y este stream es glue UI+API; la verificación
   primaria es **runtime con next-dev-loop** (lo pide el setup) + `typecheck`/`lint`/`format`.
   La lógica pura (construcción de payloads, normalización del mock) se factoriza en funciones
   chicas y legibles.

## File Structure

- `src/app/api/search/types.ts` — tipos del contrato HTTP (`SearchRequestBody`, `SearchResponse`).
- `src/app/api/search/_mock-scraper.ts` — **TEMP-MOCK**: fixtures de `PropertyResult`/`SearchOutcome`.
- `src/app/api/search/scraper.ts` — adaptador: scraper real con fallback al mock.
- `src/app/api/search/route.ts` — `POST`: gate de sesión, `SEARCH`, scraping, `SCRAPE`, respuesta.
- `src/app/api/click/types.ts` — tipo del body (`ClickRequestBody`).
- `src/app/api/click/route.ts` — `POST`: gate de sesión, `CLICK`.
- `src/app/search/page.tsx` — page (server component): gate + shell + monta la UI cliente.
- `src/app/search/search-client.tsx` — client component: form, estado, fetch, lista de resultados.
- `src/app/search/property-card.tsx` — client component: tarjeta de un resultado + click tracking.
- `src/app/dev-login/page.tsx` — **TEMP-DEV**: login de prueba (solo dev) hasta que aterrice el
  stream de auth. Gated a `NODE_ENV !== "production"`. Follow-up: borrar cuando exista `/login`.

## Plan (tareas)

### Task 1 — Contrato HTTP + mock del scraper

- `src/app/api/search/types.ts`: `SearchRequestBody { query: string }`,
  `SearchResponse { sessionId, status, source, results: PropertyResult[], count, error? }`.
- `src/app/api/search/_mock-scraper.ts`: `mockSearchOutcome(params): SearchOutcome` con ~6
  fixtures realistas de Portal Inmobiliario (title/price/currency/imageUrl/url/externalId).
  `status: "empty"` si el query contiene `"zzz"` (permite probar el estado vacío).
- `src/app/api/search/scraper.ts`: `runScrape(params): Promise<SearchOutcome>` — llama al real,
  cae al mock si lanza.

### Task 2 — API route de búsqueda

- `POST /api/search`: parse body → `createClient().auth.getUser()` (401 si no hay) → `sessionId`
  = `randomUUID()` → `logEvent(SEARCH, {query})` → `runScrape` → `logEvent(SCRAPE, {source,status,
result_count,duration_ms,http_status})` → `Response.json(SearchResponse)`. Validación: query
  no vacío → 400. Errores inesperados → 500 con mensaje genérico.

### Task 3 — API route de click

- `src/app/api/click/types.ts`: `ClickRequestBody { externalId, url, sessionId? }`.
- `POST /api/click`: gate 401 → validar `url` (http/https) → `logEvent(CLICK, {externalId,url})`
  con el `sessionId` del body → `204`.

### Task 4 — UI de búsqueda

- `property-card.tsx`: tarjeta (imagen con fallback, título, precio, link `target="_blank"`),
  `onClick` dispara `POST /api/click` con `keepalive`.
- `search-client.tsx`: form controlado, estados (idle/loading/success/empty/error), llama
  `/api/search`, guarda `sessionId`, renderiza grid de `PropertyCard`. Loading tolerante a ~30s.
- `page.tsx`: server component, doble gate (redirect a `/login` si no hay user), header + monta
  `SearchClient`.

### Task 5 — Login de prueba (temporal) + verificación runtime

- `src/app/dev-login/page.tsx`: client, `signInWithPassword` con el cliente browser Supabase.
- Crear usuario de prueba en Supabase, correr `next dev`, verificar con next-dev-loop:
  login → /search → buscar → resultados → click (evento CLICK) → estados vacío/error.
- `lint` + `typecheck` + `format:check` en verde.
