# Stream: Automatización del correo diario

**Branch:** `feature/daily-email` · **Fecha:** 2026-07-19

Job diario que envía por correo, a los evaluadores del desafío, el **historial de búsquedas del
día** de cada usuario con actividad. Corre solo (Vercel Cron) y es **idempotente**: aunque se
ejecute varias veces el mismo día, no duplica el correo de un usuario.

## Alcance (carpetas de este stream)

- `src/app/api/cron/**` — route del cron.
- `src/lib/email/**` — config, render (puro), envío (Resend), orquestación.
- `vercel.json` — schedule del cron.

No se toca: `prisma/schema.prisma`, migraciones, `layout.tsx`, `globals.css`, otros streams.

## Contratos que consumo (ya existen, congelados)

- `prisma` singleton — `@/lib/prisma`.
- Modelos `Event` (SEARCH), `EmailDispatch` (unique `userId + dispatchDate`).
- `.env`: `RESEND_API_KEY`, `EMAIL_FROM`, `EMAIL_TO` (coma-separado), `CRON_SECRET`.

## Decisiones

1. **"Historial del día" = búsquedas del día del envío**, no el historial completo. El objetivo del
   stream dice "junta el historial del día desde `events` (type='SEARCH')". Cambiar a historial
   completo es cambiar el rango de la query (una línea). El asunto del correo deja claro el alcance.

2. **Definición de "día" en `America/Santiago`.** La plataforma es chilena; "las búsquedas de hoy"
   se calcula sobre el día calendario de Santiago (con su offset/DST resuelto vía `Intl`). El rango
   `[00:00, 24:00)` local se convierte a instantes UTC para la query. `dispatch_date` guarda esa
   fecha calendario. Helper puro en `dates.ts` (testeable, sin dependencias de fecha externas).

3. **Un correo por usuario por día**, alineado con la granularidad de `email_dispatches`
   (`unique(user_id, dispatch_date)`). Cada usuario con ≥1 búsqueda ese día genera un dispatch.

4. **Idempotencia con reserva + rollback:**
   - Se intenta `INSERT` en `email_dispatches` (reserva del slot). Si choca con el unique
     constraint (`P2002`) → ya se envió hoy → **skip**.
   - Si la reserva entra → se envía el correo. Si el envío falla → se **borra** la reserva para que
     una corrida posterior reintente (at-least-once + no-duplicados).
   - El unique constraint (no un `SELECT` previo) es la barrera anti-carrera entre corridas
     concurrentes.

5. **DRY-RUN cuando `RESEND_API_KEY` es placeholder/ausente.** La key actual es `re_REEMPLAZAR`.
   Si no parece una key real de Resend, en vez de enviar se **loguea** el correo (to/from/asunto +
   texto plano) y **igual se registra el dispatch** — así la idempotencia se puede probar de punta a
   punta sin la key. Cuando se configure la key real, el mismo código envía de verdad.

6. **Etiqueta del usuario:** best-effort se resuelve el email desde `auth.users` con un
   `$queryRaw` (los recipients son evaluadores revisando actividad de todos los usuarios, así que
   identificar de quién es el historial agrega valor). Si el rol de DB no puede leer `auth.users`,
   degrada a `user <uuid-corto>`.

7. **Cron config: `vercel.json`** (cero dependencias) en vez de `vercel.ts` (requiere
   `@vercel/config`). `vercel.ts` es el enfoque más nuevo recomendado por Vercel, pero para un solo
   cron `vercel.json` es más simple y sin riesgo sobre el build. Schedule: `0 12 * * *` (12:00 UTC
   ≈ 08:00/09:00 Santiago — mañana, tras la actividad del día anterior... ver nota).

   Nota de alcance: como enviamos "búsquedas de hoy", correr a las 12:00 UTC captura la actividad
   de la mañana Santiago del **mismo** día. Es una elección consciente y documentada; el rango es
   configurable. Para "resumen del día cerrado" se correría pasada la medianoche local.

## Estructura de archivos

- `src/lib/email/config.ts` — lee env, `from`/`to`, `dryRun` (detección de key placeholder), TZ.
- `src/lib/email/dates.ts` — `zonedDayRange(now, tz)`, `formatTimeInZone(date, tz)` (puros).
- `src/lib/email/render.ts` — `renderHistoryEmail(...)` → `{ subject, html, text }` (puro).
- `src/lib/email/send.ts` — `sendEmail(msg)`: Resend real o dry-run según config.
- `src/lib/email/daily-history.ts` — `runDailyHistory(now)`: query + group + idempotencia + envío.
- `src/app/api/cron/daily-history/route.ts` — `GET`, valida `CRON_SECRET`, llama la orquestación.
- `vercel.json` — `crons`.

## Verificación

- `npm run lint`, `npm run typecheck`, `npm run format:check` en verde.
- Runtime (skill next-dev-loop): con `next dev`, `GET /api/cron/daily-history`:
  - sin/con header incorrecto → `401`.
  - con `Authorization: Bearer $CRON_SECRET` → `200` + resumen JSON; en dry-run el correo aparece
    en la consola del server.
  - segunda corrida el mismo día → los usuarios ya enviados salen como `skipped` (idempotencia).
- Se crea un usuario de prueba + algunos eventos SEARCH del día para tener actividad real.

## Follow-ups / dependencias

- **Bloqueante para envío real:** configurar `RESEND_API_KEY` real (hoy placeholder). El código ya
  queda completo; solo falta la key.
- Depende del stream de scraping/búsqueda para que el `payload` de los eventos SEARCH tenga
  `query`/`comuna`/`resultCount`. El render lee el payload de forma defensiva (no rompe si faltan).
- `EMAIL_FROM` usa `onboarding@resend.dev` (dominio de prueba de Resend). Para producción se
  verifica un dominio propio en Resend.
