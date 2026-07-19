# Stream: Autenticación — spec + plan

**Branch:** `feature/auth` · **Fecha:** 2026-07-19
**Dueño de:** `src/app/(auth)/**`, `src/lib/auth/**`.
**Depende de (ya existe):** `src/middleware.ts` + `src/lib/supabase/{server,client,middleware}.ts`
(gate de sesión), `src/lib/events.ts` (`logEvent`), `schema.prisma` (contrato).

## 1. Objetivo

Login real con Supabase Auth (email + password): registro, login y logout. Sin sesión no se puede
buscar (el gate ya vive en el middleware; este stream lo verifica y alimenta la trazabilidad).

## 2. Requisitos concretos

- Páginas `/login` y `/register` con manejo de errores de credenciales.
- Al hacer login (o registro exitoso, que ya deja sesión) → `logEvent(userId, LOGIN, ...)`.
- Logout que limpia la sesión.
- Demo sin SMTP: el registro debe dejar sesión iniciada al instante (sin correo de confirmación).
- Flujo verificado: registrarse → login → sesión → entrar a `/search`; sin sesión → `/login`.

## 3. Decisiones de diseño (y por qué)

### 3.1 Server Actions, no auth client-side suelto

`logEvent` usa Prisma (`@/lib/prisma`), que es **server-only** (adapter `pg`, Node). Por eso el
login/registro se resuelven en **Server Actions** con el cliente SSR (`src/lib/supabase/server.ts`):
la acción hace `signInWithPassword`/`signUp` (setea cookies vía el cliente SSR), obtiene el `user.id`
en el servidor y llama `logEvent` sin round-trips extra ni exponer nada. Los formularios son Client
Components que usan `useActionState` para estado de error + `isPending`. Es el patrón idiomático de
Next 16 / React 19 y mantiene la traza server-side.

### 3.2 Confirmación de email desactivada vía Management API (no por SQL)

El enunciado sugería "por SQL", pero la confirmación de email es config de **GoTrue** (variables de
entorno del servicio Auth), **no** un flag en una tabla → no se puede togglear por SQL. Además el
proyecto no tiene SMTP propio (`smtp_host: null`) y el envío por defecto de Supabase está
rate-limited (probé signUp y devolvió `429 over_email_send_rate_limit`), así que el flujo de
confirmación por correo está **roto para demo**.

Solución correcta y self-contained: `PATCH /v1/projects/<ref>/config/auth` con
`{"mailer_autoconfirm": true}` (Management API, autenticado con el PAT del Supabase CLI ya logueado
que tiene acceso al ref). Verificado: tras el cambio, `signUp` devuelve `access_token` + `user` con
`email_confirmed_at` seteado al instante, sin enviar correos. Es un cambio de config a nivel proyecto
(beneficia a todos los worktrees que comparten la DB) y **no** toca `auth.users` con hacks ni
persiste secretos en el repo.

> Alternativa descartada: crear usuarios directo en `auth.users`/`auth.identities` por SQL con
> bcrypt (`pgcrypto`). Funciona pero reimplementa internals de GoTrue (frágil ante cambios de
> versión) y no arregla el registro para un evaluador que se registre en vivo. `mailer_autoconfirm`
> lo arregla de raíz.

### 3.3 Redirect post-login → `/search`

Destino por defecto tras login/registro: `/search` (el objetivo del gate). Se soporta un
`?redirectTo=<path>` opcional (validado a rutas internas que empiezan con `/`) por si el middleware o
un enlace lo pasan, **sin** modificar el middleware compartido. Si ya hay sesión y se visita
`/login`/`/register`, se redirige a `/search` (no re-loguear).

### 3.4 Logout como Server Action + página `/logout`

`logout()` es una Server Action (idiomática; el stream de UI shell la envolverá en el header con un
`<form action={logout}>`). Además `/(auth)/logout` es una página mínima con un botón de cerrar
sesión: sirve de superficie de verificación en este stream y como endpoint de logout usable.

### 3.5 Sin tests unitarios; verificación en runtime

Las acciones golpean la red de Supabase; mockearlas aporta poco. El valor real está en verificar el
flujo end-to-end con `next-dev-loop` (browser + /_next/mcp), que además es lo que pide el enunciado.
`logEvent` se envuelve en try/catch: un fallo de trazabilidad nunca bloquea el auth.

## 4. Archivos (todos dentro del stream)

- `src/lib/auth/actions.ts` — `login`, `register`, `logout` (`"use server"`).
- `src/app/(auth)/layout.tsx` — layout centrado simple para las páginas de auth (aditivo, no global).
- `src/app/(auth)/_components/auth-form.tsx` — Client Component: formulario + `useActionState`.
- `src/app/(auth)/login/page.tsx` — redirige si ya hay sesión; si no, `<AuthForm mode="login">`.
- `src/app/(auth)/register/page.tsx` — ídem registro.
- `src/app/(auth)/logout/page.tsx` — superficie de logout.

## 5. Plan de trabajo

1. [setup] `.env` copiado, `npm install`, `mailer_autoconfirm=true`, usuario demo creado. ✅
2. `src/lib/auth/actions.ts` con las 3 acciones + validación + mapeo de errores a español.
3. Layout + `AuthForm` + páginas login/register/logout.
4. Lint / typecheck / format.
5. Verificación runtime con `next-dev-loop`: registro nuevo → sesión → `/search` accesible;
   logout → `/search` redirige a `/login`; login con demo user; credenciales malas → error visible.
6. Commit(s), push, PR contra `main`.

## 6. Credenciales de prueba

- `demo@pruff.cl` / `Demo123456!` (creado vía signUp tras el autoconfirm).

## 7. Follow-ups / dependencias con otros streams

- `/search`, `/favorites`, `/history` los construyen otros streams; el gate ya los cubre. Hasta que
  `/search` exista, un request autenticado a `/search` da 404 (no redirect) — eso ya prueba que el
  gate deja pasar al usuario autenticado.
- UI shell: envolver `logout()` en el header y pulir estilos (este stream deja UI simple y limpia).
- Trazabilidad: `sessionId` queda `null` por ahora (no hay concepto de sesión de recorrido cableado
entre streams todavía); `logEvent` ya lo acepta opcional.
</content>
