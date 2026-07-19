# Stream: Favoritos + Historial — spec breve + plan

**Fecha:** 2026-07-19
**Dueño de:** `src/app/favorites/**`, `src/app/history/**`, `src/app/api/favorites/**`
**Aditivo (contrato para otros streams):** `src/components/favorite-button.tsx`,
`src/lib/favorites.ts`.

## Objetivo

Marcar/desmarcar favoritos (estado propio + snapshot mínimo) y ver el historial de búsquedas del
usuario. Todo requiere sesión (usuario resuelto server-side).

## Requisitos cubiertos (del desafío / AGENTS.md)

- Favoritos visibles en la plataforma, con link a la URL original.
- Historial de búsquedas leído de `events WHERE type='SEARCH'` (NO tabla propia — DECISIONS §2).
- Trazabilidad: cada toggle registra `FAVORITE_ADD` / `FAVORITE_REMOVE` vía `logEvent`.
- Regla de oro: solo estado propio. El favorito guarda referencia (`external_id` + `url`) + snapshot
  mínimo (`title`, `price`, `currency`, `image_url`). Nunca se persiste catálogo.

## Diseño

### API — `src/app/api/favorites/route.ts`

Handlers REST (el botón cliente decide método según su estado actual → toggle sin race de lectura):

- `POST` — agrega. Body `{ externalId, url, title, price?, currency?, imageUrl? }`.
  - 401 si no hay sesión; 400 si faltan `externalId|url|title`.
  - Upsert en `favorites` (unique `user_id,external_id`) → refresca snapshot si ya existía.
  - `logEvent(FAVORITE_ADD)` **solo cuando se crea** (no en re-marcado) → traza limpia.
  - Responde `{ favorited: true }`.
- `DELETE` — quita. Body `{ externalId }`.
  - 401 / 400 análogos. `deleteMany(user_id, external_id)`.
  - `logEvent(FAVORITE_REMOVE)` **solo si borró algo** (`count > 0`).
  - Responde `{ favorited: false }`.
- `GET` — lista los favoritos del usuario en JSON (útil para el stream de search y para clientes).
  Responde `{ favorites: Favorite[] }`.

**Decisión:** POST/DELETE explícitos en vez de un único endpoint "toggle" que lee-luego-escribe.
Evita una lectura extra y una condición de carrera; el botón ya conoce su estado. Idempotente:
re-POST refresca snapshot, re-DELETE es no-op.

### Data helpers — `src/lib/favorites.ts`

- `getFavorites(userId)` → `Favorite[]` ordenados por `created_at desc`.
- `getFavoriteIdSet(userId)` → `Set<string>` de `externalId` (para que search marque resultados ya
  favoriteados sin N queries). Contrato pensado para el stream de search.

### Botón reutilizable — `src/components/favorite-button.tsx` (client)

Props: `property` (los campos del snapshot), `initialFavorited`, `onChange?`. Corazón con estado
optimista; llama POST/DELETE; deshabilitado mientras hay request; revierte en error. Sin
`router.refresh()` por defecto (para no re-disparar búsquedas en la página de search). En la página
`/favorites` se envuelve para refrescar al quitar.

### `/favorites` — `src/app/favorites/page.tsx` (server component)

Resuelve usuario (redirect `/login` si falta; el middleware ya protege, esto es defensa + userId).
Lista favoritos desde el snapshot (se ven aunque la publicación ya no exista). Cada card: imagen,
título, precio, link "Ver publicación" (`target=_blank`) y botón quitar (refresca al quitar).
Empty state.

### `/history` — `src/app/history/page.tsx` (server component)

Lee `events` (`type=SEARCH`, del usuario, `created_at desc`). Extrae `payload.query` (y `comuna` si
existe). Cada item es clickeable para re-buscar → `/search?query=<encoded>`. Muestra fecha/hora.

**Decisión:** el link de re-búsqueda usa el query param `query` (coincide con la key del payload
SEARCH). El stream de search debe leer `searchParams.query`. Documentado como dependencia.

### Navegación

No se toca `layout.tsx` global. Se agrega `src/components/app-nav.tsx` (aditivo) — barra mínima
con links Buscar/Favoritos/Historial, usada por mis dos páginas para poder navegar y verificar.

## Fuera de alcance / dependencias

- **Login/Auth:** otro stream. Sin `/login` la ruta protegida redirige a un 404 temporal. Para
  verificar creo una sesión de prueba (usuario Supabase Auth) inyectando cookies en el browser.
- **CLICK events:** se registran desde el stream de search/traceability (endpoint fuera de mi
  scope). Los links de favoritos quedan como `<a>` normales. Follow-up documentado.
- **Página `/search`:** otro stream; el historial ya enlaza a `/search?query=...`.

## Verificación (next-dev-loop)

1. `next dev` corriendo.
2. Crear usuario de prueba vía Supabase Auth (signUp anon; confirmar por SQL si hiciera falta).
3. Inyectar cookies de sesión `@supabase/ssr` en el browser y navegar.
4. Probar: agregar/quitar favorito (API + UI), ver `/favorites`, ver `/history` con un evento
   SEARCH sembrado. Confirmar filas en `favorites` y `events` (FAVORITE_ADD/REMOVE) vía DB.
5. `npm run lint`, `npm run typecheck`, `npm run format:check` en verde.
