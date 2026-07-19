# Stream: UI shell + design system

**Owner de:** `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx` (landing),
`src/components/**`, y el tema Tailwind. Único stream que toca layout/globals.

## Objetivo

Un shell coherente y prolijo (la UX/UI se evalúa): navegación responsiva (Inicio, Buscar,
Favoritos, Historial, sesión/logout), tema claro/oscuro, landing explicativa, y un set de
componentes de presentación reutilizables que los demás streams consumen. **No** implemento la
lógica de búsqueda/favoritos/auth: solo la capa de presentación y sus contratos.

## Decisiones de diseño

1. **Design tokens semánticos en `globals.css`** (Tailwind v4 `@theme`): `background/foreground`,
   `card`, `muted`, `border`, `primary`, `accent` (precios), `destructive`. Se consumen como
   utilidades (`bg-card`, `text-muted-foreground`, `bg-primary`…). Un solo lugar define la paleta.
2. **Tema claro/oscuro por atributo `data-theme`**, no por `prefers-color-scheme` puro: permite
   un toggle manual. `@custom-variant dark` apunta a `[data-theme="dark"]`. Un script inline en
   `<head>` fija el tema antes del paint (sin FOUC), respetando `localStorage` y, si no hay
   preferencia, el sistema.
3. **Dependencias añadidas:** `clsx` + `tailwind-merge` (helper `cn` para override de clases sin
   conflictos) y `class-variance-authority` (variantes declarativas de Button). Estándar del
   ecosistema, muy livianas. Los conflictos de `package-lock` entre PRs se resuelven al mergear.
4. **`PropertyCard` alineado con el contrato del scraper** (`PropertyResult`:
   `{ externalId, title, price, currency, imageUrl, url }`) + un `favoriteSlot?: ReactNode`
   (render slot en la esquina superior) que el stream de favoritos rellena con su toggle. La card
   es un `<a>` a la URL original (requisito: cada resultado clickeable al portal); el
   `favoriteSlot` se aísla del click con `stopPropagation` desde el consumidor.
5. **Imágenes con `<img>` nativo, no `next/image`.** Las imágenes vienen de múltiples CDNs de
   MercadoLibre (`http2.mlstatic.com`, etc.); configurar `remotePatterns` para todos es frágil y
   tocaría `next.config.ts` (fuera de mi stream). `<img>` con `loading="lazy"` + fallback para
   `imageUrl === null` es robusto y suficiente. Documentado como follow-up si se quiere
   optimización de imágenes.
6. **`SessionNav` (Server Component) hace un best-effort read del usuario** con el helper existente
   `createClient()` de supabase/server, envuelto en `try/catch`: si no hay sesión o el entorno no
   está listo, muestra estado "desconectado" (CTA Iniciar sesión). No implementa auth; solo refleja
   estado para que el shell se vea correcto. Logout apunta a `/logout` (ruta del stream de auth).
7. **Estados de carga/vacío/error como componentes de primera clase:** `Skeleton`,
   `PropertyCardSkeleton`, `PropertyGrid` (+ modo skeleton), `EmptyState`, `ErrorState`.

## Componentes entregados (contratos para otros streams)

- `ui/`: `Button` (variants: primary/secondary/outline/ghost/destructive; sizes; `loading`;
  `asChild` para envolver `<Link>`), `Input` (label, error, hint, icon), `Card` (+ Header/Title/
  Content/Footer), `Badge`, `Spinner`, `Skeleton`.
- `property/`: `PropertyCard`, `PropertyCardSkeleton`, `PropertyGrid`.
- `feedback/`: `EmptyState`, `ErrorState`.
- `layout/`: `Header` (nav responsiva + menú móvil), `Footer`, `NavLinks` (active state),
  `ThemeToggle`, `SessionNav`, `Logo`, `PageContainer`.
- Barrels (`index.ts`) por carpeta + `src/components/index.ts` para import ergonómico.

## Dependencias con otros streams (follow-ups)

- **Auth:** `/login`, `/logout` y la sesión real. El shell ya deja los slots y links listos.
- **Búsqueda:** consumirá `PropertyGrid` + `PropertyCard` en `/search`.
- **Favoritos:** rellenará `favoriteSlot` con su toggle; usará `PropertyCard`/`EmptyState`.
- **Historial:** usará `EmptyState` y componentes de listado (los eventos `SEARCH`).

## Verificación

`npm run lint`, `npm run typecheck`, `npm run format:check` en verde + verificación en runtime con
la skill `next-dev-loop` (landing + estados renderizan; toggle de tema funciona; nav responsiva).
