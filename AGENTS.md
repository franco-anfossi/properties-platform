<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Plataforma de Propiedades con Scraping (Prueba Pruff)

Plataforma web que muestra un catálogo de propiedades obtenido **en vivo** (scraping) desde
**Portal Inmobiliario**, con login real, favoritos, historial de búsquedas, un job diario que
envía el historial por correo, y trazabilidad de punta a punta.

- **Enunciado del desafío:** `docs/Desafío ingreso Pruff.pdf`
- **Diseño completo:** `docs/superpowers/specs/2026-07-19-plataforma-propiedades-scraping-design.md`
- **Razonamiento entregable:** `DECISIONS.md` (pesa tanto como el código — mantenerlo al día).

## Regla de oro del modelo de datos

La DB guarda **SOLO estado propio**. Las **propiedades NUNCA se persisten** como catálogo (son
dato efímero del portal). La única excepción es el **snapshot mínimo** dentro de un favorito
(título/precio/imagen del momento en que el usuario lo marcó) — eso es estado propio.

## Stack

- **Next.js** (App Router, TypeScript, Tailwind, `src/`) — full-stack, deploy en Vercel.
- **Supabase Postgres** (DB) + **Supabase Auth** (login; credenciales en el schema `auth`).
- **Prisma 7** para nuestras tablas del schema `public` (driver adapter `@prisma/adapter-pg`).
- **SMTP (Gmail vía Nodemailer)** para el correo diario. Resend sin dominio verificado solo envía
  al email de la propia cuenta; Gmail SMTP (App Password) envía a cualquier destinatario.
- **Vercel Cron** para el scheduler (alternativa: `pg_cron`).

### Prisma 7 — particularidades

- Las URLs de conexión viven en `prisma.config.ts`, **no** en `schema.prisma`.
- Runtime: driver adapter con `DATABASE_URL` (pooler Supabase, 6543). Migraciones: `DIRECT_URL` (5432).
- Cliente generado en `src/generated/prisma/` (gitignoreado; se regenera con `postinstall`).
  Importar desde **`@/generated/prisma/client`** (la entrada es `client.ts`, no `index.ts`).

## Modelo de datos (tablas propias, en `public`)

- `events` — **spine de trazabilidad**, append-only. Tipos: `LOGIN, SEARCH, SCRAPE, CLICK,
FAVORITE_ADD, FAVORITE_REMOVE`. Reconstrucción con **una sola query**:
  `SELECT * FROM events WHERE user_id = $1 ORDER BY created_at ASC`.
  El historial de búsquedas se lee de aquí (`type='SEARCH'`), no hay tabla aparte.
- `favorites` — referencia (`external_id` + `url`) + snapshot mínimo. Unique(`user_id`, `external_id`).
- `email_dispatches` — idempotencia del cron. El correo diario es **un digest único** con el
  historial de todos los usuarios, por eso es Unique(`dispatch_date`) (uno por día).

`user_id` referencia `auth.users.id` (UUID), sin FK cross-schema.

## Módulos e interfaces (contrato = `schema.prisma`; pensados para trabajo paralelo)

- `src/lib/scraper/` — `searchProperties(params): Promise<SearchOutcome>`. Tipos en `types.ts`
  (`PropertyResult`, `SearchOutcome`). HTTP directo a Portal Inmobiliario; función pura, no persiste.
- `src/lib/events.ts` — `logEvent(...)`, único helper de trazabilidad. Todo evento pasa por aquí.
- `src/lib/prisma.ts` — cliente Prisma singleton (con adapter pg).
- `src/lib/supabase/{server,client,middleware}.ts` — clientes SSR + gate de sesión.
- `src/middleware.ts` — protege `/search`, `/favorites`, `/history` (sin sesión → `/login`).

## Scraping — por qué HTTP directo

Portal Inmobiliario responde HTTP 200 sin bloqueo anti-bot y sirve la data embebida como JSON
"polycard" en el HTML server-rendered (título, permalink, precio, imagen). Se obtiene todo con un
`fetch`, sin navegador headless. Robustez: si el JSON cambia/no aparece → error tipado (no
crashea), se registra `SCRAPE` con `status=error`. Portal de respaldo documentado: PortalTerreno.

## Comandos

- `npm run dev` — dev server
- `npm run lint` / `npm run lint:fix` — ESLint
- `npm run format` / `npm run format:check` — Prettier (con orden de clases Tailwind)
- `npm run typecheck` — `tsc --noEmit`
- `npm run db:migrate` — crear/aplicar migración (necesita `DIRECT_URL`)
- `npm run db:generate` — regenerar cliente Prisma
- `npm run db:studio` — Prisma Studio

## Convenciones

- Formato: Prettier manda (config en `.prettierrc.json`). Correr `npm run format` antes de commitear.
- Variables/args no usados: prefijo `_` (ej. `_params`).
- Secretos: nunca commitear `.env`. Plantilla en `.env.example`.
- Al editar código de app, verificar en runtime con la skill `next-dev-loop` (no solo typecheck).
