# Plataforma de Propiedades con Scraping

Catálogo de propiedades obtenido **en vivo** desde
[Portal Inmobiliario](https://www.portalinmobiliario.com) (scraping por HTTP directo), con login
real, favoritos, historial de búsquedas, un job diario que envía el historial por correo, y
trazabilidad de punta a punta. Prueba de ingreso Pruff — Software Engineer.

**🔗 En vivo:** https://properties-platform.vercel.app
**🧠 Razonamiento de diseño:** [`DECISIONS.md`](./DECISIONS.md) · [spec completo](./docs/superpowers/specs/2026-07-19-plataforma-propiedades-scraping-design.md)

## Cómo probarla

1. Entra a https://properties-platform.vercel.app
2. **Regístrate** con cualquier email/clave (la confirmación de correo está desactivada para la
   demo → quedas con sesión al instante). Sin sesión no se puede buscar.
3. **Busca** por comuna o dirección (ej: `Providencia`, `Ñuñoa`). Resultados en vivo, cada tarjeta
   enlaza a la publicación **original** en el portal.
4. Marca **favoritos** (♡ en cada tarjeta) y revisa tu **historial** de búsquedas.

## Stack

- **Next.js** (App Router, TypeScript, Tailwind) — full-stack, desplegado en **Vercel**.
- **Supabase Postgres** (DB) + **Supabase Auth** (login; credenciales en el schema `auth`).
- **Prisma 7** para las tablas propias del schema `public` (driver adapter `@prisma/adapter-pg`).
- **Resend** para el correo diario · **Vercel Cron** como scheduler.

## Modelo de datos — solo estado propio

La DB guarda **solo lo que nos pertenece**; las **propiedades nunca se persisten** (son dato
efímero del portal). La única excepción es el snapshot mínimo dentro de un favorito.

| Tabla              | Rol                                                                                                                                    |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `events`           | **Spine de trazabilidad** append-only (`LOGIN, SEARCH, SCRAPE, CLICK, FAVORITE_ADD/REMOVE`). El historial de búsquedas se lee de aquí. |
| `favorites`        | Referencia (`external_id` + `url`) + snapshot mínimo (título/precio/imagen).                                                           |
| `email_dispatches` | Idempotencia del cron (unique `user_id` + `dispatch_date`).                                                                            |

### Trazabilidad con una sola query

```sql
SELECT * FROM events WHERE user_id = $1 ORDER BY created_at ASC;
```

reconstruye el recorrido completo: `login → búsqueda → scraping → click → favorito`.

## Scraping — por qué HTTP directo

Portal Inmobiliario responde HTTP 200 sin bloqueo anti-bot y sirve la data embebida como JSON
"polycard" en el HTML server-rendered. Se obtiene todo con un `fetch` (~1.3 MB, ~1 s), sin
navegador headless — más rápido y robusto que Playwright. Si el formato cambia o el portal falla,
el scraper devuelve un error tipado (no crashea) y se registra `SCRAPE` con `status=error`.
Detalle en [`DECISIONS.md`](./DECISIONS.md).

## Desarrollo local

```bash
npm install                # instala deps y genera el cliente Prisma (postinstall)
cp .env.example .env       # completa con tus credenciales de Supabase / Resend
npm run db:migrate         # aplica las migraciones (necesita DIRECT_URL)
npm run dev                # http://localhost:3000
```

Variables de entorno: ver [`.env.example`](./.env.example). En runtime la app usa el pooler de
Supabase (`DATABASE_URL`, 6543); las migraciones usan la conexión directa (`DIRECT_URL`, 5432).

### Comandos

| Comando                            | Qué hace                                                                    |
| ---------------------------------- | --------------------------------------------------------------------------- |
| `npm run dev`                      | Dev server                                                                  |
| `npm run build`                    | Build de producción                                                         |
| `npm run typecheck`                | `tsc --noEmit`                                                              |
| `npm run lint` / `npm run format`  | ESLint / Prettier                                                           |
| `npm test`                         | Tests (Vitest) · `npm run test:live` corre el scraper contra el portal real |
| `npm run db:migrate` / `db:studio` | Migraciones / Prisma Studio                                                 |

## Automatización — correo diario

Un [Vercel Cron](./vercel.json) dispara `POST /api/cron/daily-history` a diario (protegido con
`CRON_SECRET`). Arma el historial del día por usuario y lo envía a los destinatarios de `EMAIL_TO`
vía Resend. Es **idempotente**: `email_dispatches` evita duplicar el correo del día. Sin
`RESEND_API_KEY` real, corre en **dry-run** (loguea el correo en vez de enviarlo).
