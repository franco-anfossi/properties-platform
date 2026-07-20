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

**Cómo se extrae (implementado en `src/lib/scraper/`, verificado en vivo el 2026-07-19):** cada
propiedad viene como un objeto `{"id":"POLYCARD",…,"polycard":{…}}` embebido en el HTML. No se usa
regex frágil: se localiza cada marcador y se extrae el objeto con un **escáner de llaves balanceadas
consciente de strings** (respeta `{`/`}` y `\"` dentro de comillas), luego `JSON.parse`. Un bloque
que no parsea se **descarta** sin romper el resto. Detalles del mapeo:

- **Dedup por `metadata.id`**: una búsqueda trae ~150 bloques que son ~48 publicaciones únicas (cada
  una repetida ~3× por distintos layouts). Ante duplicados se prefiere el **permalink** real sobre el
  redirect de anuncio (`click1.portalinmobiliario.com`, cards con `is_pad:"true"`).
- **Precio**: `components[price].current_price {value, currency}`. `CLF` → UF, `CLP` → $; formato
  chileno con separador de miles (`UF 4.957`, `$350.000.000`).
- **Imagen por construcción** (no segundo parse): `https://http2.mlstatic.com/D_NQ_NP_<pictureId>-O.webp`
  a partir de `pictures.pictures[0].id` (verificado HTTP 200 `image/webp`).
- **URL**: los permalinks vienen **relativos sin scheme** (`portalinmobiliario.com/MLC-…-_JM`); se
  antepone `https://`. La query (comuna/dirección) se _slugifica_ (sin acentos, `ñ→n`) y se mapea a
  `{operation}/{propertyType}/{comuna}-metropolitana` (sin sufijo de región el portal responde 301).

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

**Trazabilidad con una sola query** — ver sección **2.1** (dedicada al requisito central).

## 2.1. Trazabilidad de punta a punta — la query única

Requisito central del desafío: reconstruir con **una sola query** el recorrido completo de un
usuario `login → búsqueda → scraping → click → favorito`. La query, literal:

```sql
SELECT * FROM events WHERE user_id = $1 ORDER BY created_at ASC;
```

**Por qué una sola query alcanza.** `events` es un spine append-only: cada acción del recorrido se
escribe como una fila (todo pasa por un único helper, `logEvent`). No hay que hacer `JOIN`s ni unir
tablas por tipo de acción — el orden cronológico (`created_at ASC`) _es_ el recorrido. El índice
`(user_id, created_at)` hace que la reconstrucción sea un range scan directo. En Prisma el
equivalente tipado es `prisma.event.findMany({ where: { userId }, orderBy: { createdAt: "asc" } })`,
que compila exactamente a ese `SELECT`.

**Contrato de payload por `EventType`** (deliverable de coordinación entre streams). El `payload`
es JSONB flexible, así que enriquecer un evento **no toca el schema**. Convención: claves
`camelCase` (JS-native, igual que los campos Prisma). El lector es defensivo y también acepta las
variantes `snake_case`.

| Tipo              | payload (canónico)                                                                    |
| ----------------- | ------------------------------------------------------------------------------------- |
| `LOGIN`           | `{ method?, email? }`                                                                 |
| `SEARCH`          | `{ query, comuna?, searchId?, filters? }`                                             |
| `SCRAPE`          | `{ source, status, resultCount, durationMs, httpStatus?, query?, searchId?, error? }` |
| `CLICK`           | `{ externalId, url, title? }`                                                         |
| `FAVORITE_ADD`    | `{ externalId, url, title?, price? }`                                                 |
| `FAVORITE_REMOVE` | `{ externalId, url?, title? }`                                                        |

**Claves de correlación** que hacen el recorrido no solo cronológico sino _enlazable_:

- **`session_id`** (columna) agrupa un recorrido individual (la reconstrucción los separa por sesión).
- **`searchId`** (en payload) enlaza `SEARCH ↔ SCRAPE`: qué scraping resultó de qué búsqueda.
- **`externalId`** (en payload) enlaza `CLICK ↔ FAVORITE_*`: la misma propiedad a lo largo del embudo.

Nota de diseño: `searchId` es correlación **a nivel de payload**, no una columna nueva — así el
requisito "no cambiar el schema" se respeta y el modelo de eventos sigue siendo un spine plano.

**Cómo se expone** (`src/lib/traceability.ts` es el read-side; `logEvent` es el write-side):

- `getUserTimeline(userId)` corre la query única y devuelve `{ query, events, sessions }`, donde
  `sessions` es el timeline ya reconstruido (agrupado por `session_id`, legible).
- **Endpoint** `GET /api/traceability` — modelo de acceso:
  - _Self mode_: con sesión Supabase válida devuelve el recorrido del propio usuario (producción).
  - _Debug mode_: `?userId=<uuid>` + secreto (`x-debug-secret` o `?secret=`) = `CRON_SECRET`.
    Permite al evaluador inspeccionar cualquier recorrido sin flujo de login. Se deshabilita si
    `CRON_SECRET` está vacío. Sin credenciales → `401`.
- **Página de debug** `/debug/traceability` — renderiza el timeline como línea de tiempo vertical
  y trae un botón "Sembrar recorrido de ejemplo" (server action) que genera
  `login → búsqueda → scraping → click → favorito` en vivo. Funciona con un usuario demo aunque el
  stream de auth aún no exista.

**Cómo se verificó.** `npm run verify:traceability` (`scripts/verify-traceability.ts`) siembra un
recorrido sintético contra la DB real, corre la query única y comprueba las invariantes: 5 pasos,
orden `LOGIN → SEARCH → SCRAPE → CLICK → FAVORITE_ADD`, `SEARCH.searchId == SCRAPE.searchId`,
`CLICK.externalId == FAVORITE_ADD.externalId`; luego limpia. Además se validó en runtime en el
navegador (sembrar en `/debug/traceability` y ver el timeline reconstruido).

Reconstruye `login → búsqueda → scraping → click → favorito`.

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
- **SMTP (Gmail) para el correo diario**: Supabase no envía correos arbitrarios (solo de auth).
  Se evaluó Resend, pero **sin un dominio verificado Resend solo envía al email de la propia
  cuenta**, no a destinatarios arbitrarios como los del desafío. SMTP con una cuenta Gmail (App
  Password) envía a cualquier dirección sin dominio propio, así que es el camino pragmático para
  cumplir "enviar a juanjose@ y ramiro.galvez@". Con más tiempo / dominio propio se volvería a un
  proveedor transaccional (Resend/SES) con DKIM para mejor entregabilidad.
- **Vercel Cron**: scheduler del job diario; la lógica (Prisma + envío) vive natural en una route.
  Alternativa evaluada: `pg_cron` de Supabase.
