# Plataforma de Propiedades con Scraping — Diseño

**Fecha:** 2026-07-19
**Contexto:** Prueba de ingreso Pruff (Software Engineer). Ver `docs/Desafío ingreso Pruff.pdf`.
**Estado:** Diseño aprobado. Pendiente implementación.

## 1. Objetivo

Plataforma web que muestra un catálogo de propiedades obtenido **en vivo** desde un portal
inmobiliario chileno, con login real, favoritos, historial de búsquedas, un job diario que envía
el historial por correo, y trazabilidad de punta a punta reconstruible con una sola query.

Lo evaluado: cómo se programa, qué decisiones se toman, y si se entiende lo que se entrega. El
`DECISIONS.md` pesa tanto como el código.

## 2. Requisitos (del desafío)

- **Búsqueda en vivo** por dirección/comuna que replique el portal elegido. Mínimo por propiedad:
  título + precio. Plus: imagen. Cada resultado clickeable a la **URL original**.
- **Login real** con credenciales en DB. Sin sesión no se puede buscar.
- **Favoritos** e **historial de búsquedas** visibles en la plataforma.
- **Job diario agendado** (corre solo) que envía el historial de cada usuario a
  `juanjose@pruff.com` y `ramiro.galvez@pruff.com`. **Idempotente**: aunque corra más de una vez,
  el correo del día no se duplica.
- **NO persistir propiedades** en la DB. Son dato efímero del portal. Decidir qué es estado propio.
- **Trazabilidad end-to-end**: reconstruir con **una sola query** el recorrido
  `login → búsqueda → scraping → click → favorito`.
- **UX/UI** evaluada. Tiempo de carga hasta ~30s tolerable.
- Scraping lo más eficiente posible; HTTP directo mejor que headless si se logra, y justificarlo.
- Entregable `DECISIONS.md`: scraping, modelo de datos, robustez, un trade-off.

## 3. Stack

| Capa      | Elección                           | Motivo                                                                                          |
| --------- | ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| App       | Next.js (App Router, TS, Tailwind) | Full-stack en un repo; deploy directo en Vercel (bonus).                                        |
| DB        | Supabase Postgres                  | El equipo lo maneja; Postgres serverless; dashboard cómodo.                                     |
| Auth      | Supabase Auth                      | Credenciales en el schema `auth` del propio Postgres → cumple "login real con DB propia".       |
| ORM       | Prisma (tablas `public`)           | Schema versionado + migraciones = contrato de paralelismo y punto fuerte del "modelo de datos". |
| Email     | Resend                             | Nativo del ecosistema, SDK simple. Supabase **no** envía correos arbitrarios (solo auth).       |
| Scheduler | Vercel Cron                        | Route agendada; alternativa documentada: `pg_cron` de Supabase.                                 |
| Deploy    | Vercel                             | Cubre el bonus de deploy.                                                                       |

### Portal objetivo: Portal Inmobiliario (HTTP directo)

Sondeo técnico (2026-07-19) confirmó:

- Responde **HTTP 200 sin bloqueo anti-bot** (infra MercadoLibre / Tengine, no Cloudflare).
- La data de las propiedades viene **embebida como JSON "polycard"** en el HTML server-rendered:
  ~28 propiedades por página con **título, permalink (URL original), precio e imagen**.
- **No requiere Playwright.** Scraping por **HTTP directo** (~1.3 MB en ~1 s por búsqueda).

Portal de respaldo documentado: **PortalTerreno** (para el punto de robustez).

## 4. Modelo de datos

Principio: la DB guarda **solo estado propio**; las propiedades **nunca** se persisten como catálogo.
El único snapshot permitido es el mínimo dentro de un favorito (es lo que el usuario guardó).

Usuarios en `auth.users` (gestionado por Supabase). Prisma gestiona el schema `public`:

| Tabla              | Rol                                     | Campos clave                                                                                                                            |
| ------------------ | --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `events`           | **Spine de trazabilidad** (append-only) | `id`, `user_id` (UUID), `session_id`, `type`, `payload` JSONB, `created_at`                                                             |
| `favorites`        | Estado propio (toggle)                  | `id`, `user_id`, `external_id`, `url`, snapshot: `title`/`price`/`currency`/`image_url`, `created_at`. Unique(`user_id`, `external_id`) |
| `email_dispatches` | Idempotencia del cron                   | `id`, `user_id`, `dispatch_date`, `sent_at`. Unique(`user_id`, `dispatch_date`)                                                         |

Notas:

- `events.type` ∈ `{ LOGIN, SEARCH, SCRAPE, CLICK, FAVORITE_ADD, FAVORITE_REMOVE }`.
- `payload` flexible por tipo: SEARCH → `{query, comuna, filters}`; SCRAPE → `{source, status,
result_count, duration_ms, http_status}`; CLICK → `{external_id, url}`; FAVORITE_ADD →
  `{external_id, url, title, price}`.
- **Historial de búsquedas** no es tabla propia: se lee de `events WHERE type='SEARCH'`.
- `user_id` referencia `auth.users.id` como UUID (sin FK cross-schema; relación no forzada por Prisma).
- Prisma usa `DATABASE_URL` (pooler, 6543) para la app y `DIRECT_URL` (5432) para migraciones.

### Query única de trazabilidad

```sql
SELECT * FROM events WHERE user_id = $1 ORDER BY created_at ASC;
```

Reconstruye `login → búsqueda → scraping → click → favorito` para un usuario. `session_id` permite
agrupar por recorrido individual.

## 5. Módulos e interfaces (para paralelizar)

Contrato compartido = `schema.prisma`. Con schema + firmas definidas, estos streams avanzan casi
sin pisarse:

- **Scraper** — `searchProperties(query): Promise<PropertyResult[]>`
  `PropertyResult = { externalId, title, price, currency, imageUrl, url }`.
  Fetch HTTP directo a Portal Inmobiliario → extrae JSON polycard → normaliza. Función pura,
  testeable con fixtures. No persiste nada.
- **Traceability** — `logEvent(userId, sessionId, type, payload)`. Único helper que todos usan.
- **Auth** — Supabase Auth + middleware `@supabase/ssr` que bloquea buscar sin sesión. Tras
  sign-in exitoso se llama `logEvent(LOGIN)`.
- **Favorites/History** — API + UI. Dependen de `logEvent` + tabla `favorites`.
- **Cron/Email** — route diaria + Resend + chequeo de idempotencia contra `email_dispatches`.
- **UI shell** — buscador, resultados clickeables, favoritos, historial.

## 6. Robustez del scraping

- Timeout por request y reintentos acotados.
- Si el HTML/JSON del portal cambia (no se encuentra el bloque polycard) → **error tipado**, la
  plataforma no crashea; se registra SCRAPE con `status=error`.
- Si el portal bloquea o no responde → degradación elegante con mensaje al usuario.
- Portal de respaldo (PortalTerreno) documentado como plan B.

## 7. Trade-offs conocidos (borrador para DECISIONS.md)

- **Favorito con snapshot mínimo** en vez de solo referencia: se defiende como estado propio y
  mantiene los favoritos visibles aunque la publicación muera. Alternativa más pura (solo
  `external_id`+`url` con re-scrape on-demand) queda descartada por fragilidad de UX.
- **Vercel Cron** sobre `pg_cron`: la lógica del correo (Prisma + Resend) vive más natural en una
  route de Next.js. Alternativa documentada.

## 8. Parte 0 (setup / scaffolding)

1. `create-next-app` (TS, App Router, Tailwind) sobre el repo actual.
2. Prisma + `schema.prisma` con `events`, `favorites`, `email_dispatches` + primera migración.
3. Cliente Supabase (`@supabase/ssr`) + middleware de sesión (stub).
4. Stubs tipados de cada módulo (scraper, events, auth) con sus interfaces.
5. `.env.example` (`DATABASE_URL`, `DIRECT_URL`, Supabase URL/keys, `RESEND_API_KEY`, `CRON_SECRET`).
6. `DECISIONS.md` inicial con las decisiones ya tomadas.
7. Commit.

## 9. Fuera de alcance (YAGNI)

- Realtime, storage de imágenes, APIs auto-generadas de Supabase.
- Persistir catálogo de propiedades.
- Múltiples portales en simultáneo (Portal Inmobiliario es el primario; PortalTerreno solo documentado).
