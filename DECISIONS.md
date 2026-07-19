# DECISIONS.md

Razonamiento detrás de la plataforma. Documento vivo: se completa a medida que avanza la
implementación. Diseño completo en
`docs/superpowers/specs/2026-07-19-plataforma-propiedades-scraping-design.md`.

## 1. Scraping — ¿cómo y por qué?

**Portal elegido:** Portal Inmobiliario. **Método:** HTTP directo (sin navegador headless).

Antes de elegir hice un sondeo técnico de dos portales:

- **Portal Inmobiliario** responde `HTTP 200` **sin bloqueo anti-bot** (infra de MercadoLibre /
  Tengine, no Cloudflare). La data de las propiedades viene **embebida como JSON "polycard"** en
  el HTML server-rendered: ~28 propiedades por página con título, permalink (URL original),
  precio e imagen. Todo se obtiene con un solo `fetch` (~1.3 MB, ~1 s).
- **PortalTerreno** (respaldo) responde con redirect y CloudFront delante.

**Por qué HTTP directo y no Playwright:** el desafío pide el scraping "lo más eficiente posible" y
valora obtener la data con peticiones HTTP directas. Como la data ya viene en el HTML, un navegador
headless sería overhead puro (más RAM, más latencia, más frágil) sin ganancia. HTTP directo es más
rápido, más barato y más simple de operar. Playwright queda como plan de contingencia si el portal
migrara a rendering 100% client-side.

## 2. Modelo de datos — ¿qué guardo y qué no?

**Principio:** la DB guarda **solo estado propio**. Las **propiedades no se persisten** como
catálogo — son dato efímero del portal. Cada búsqueda scrapea en vivo.

Tablas propias (schema `public`, gestionadas por Prisma):

- **`events`** — spine de trazabilidad append-only (`LOGIN, SEARCH, SCRAPE, CLICK, FAVORITE_ADD,
FAVORITE_REMOVE`) con `payload` JSONB flexible. Sostiene tanto la auditoría end-to-end como el
  historial de búsquedas (se lee `WHERE type='SEARCH'`, sin tabla aparte).
- **`favorites`** — referencia (`external_id` + `url`) + **snapshot mínimo** (título/precio/imagen).
- **`email_dispatches`** — idempotencia del job diario (`unique(user_id, dispatch_date)`).

Los usuarios viven en `auth.users` (Supabase Auth); nuestras tablas solo referencian `user_id`.

**Trazabilidad con una sola query** (requisito del desafío):

```sql
SELECT * FROM events WHERE user_id = $1 ORDER BY created_at ASC;
```

reconstruye `login → búsqueda → scraping → click → favorito`.

## 3. Robustez — ¿qué pasa si el portal cambia, bloquea o no responde?

- **Cambia el HTML/JSON** (no aparece el bloque polycard) → el scraper devuelve un **error tipado**;
  la plataforma no crashea y registra un evento `SCRAPE` con `status=error`.
- **Bloqueo / no responde / timeout** → degradación elegante: mensaje claro al usuario, reintentos
  acotados, y el error queda trazado.
- **Contingencia de método** → PortalTerreno documentado como portal de respaldo, y Playwright como
  fallback de técnica si el portal deja de server-renderear.

## 4. Trade-off consciente

**Favorito con snapshot mínimo** en lugar de guardar solo la referencia (`external_id` + `url`).
La interpretación más pura de "no guardes propiedades" sería guardar solo la referencia y
re-scrapear on-demand para mostrar el favorito. Lo descarté porque hace la UX frágil: si la
publicación se cae o cambia, el favorito queda roto. Guardo un snapshot mínimo del momento en que
el usuario marcó — que es **estado propio** (lo que el usuario decidió guardar), no un catálogo de
propiedades. **Con más tiempo:** un refresco periódico opcional del snapshot y marca visual de
"esta publicación ya no está disponible".

## Decisiones de stack (resumen)

- **Next.js + Vercel**: full-stack en un repo, deploy directo (cubre el bonus).
- **Supabase** (Postgres + Auth): lo maneja el equipo; credenciales en el `auth` del propio Postgres.
- **Prisma 7**: schema versionado + migraciones (buen soporte al punto de "modelo de datos").
- **Resend**: envío del correo diario (Supabase no envía correos arbitrarios).
- **Vercel Cron**: scheduler del job diario; la lógica (Prisma + Resend) vive natural en una route.
  Alternativa evaluada: `pg_cron` de Supabase.
