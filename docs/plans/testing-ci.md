# Stream: Testing infra + CI

**Dueño de:** `.github/workflows/**`, config del test runner (Vitest), scripts de test en
`package.json`. Objetivo: que cada PR corra checks automáticos sin depender de secretos ni de la DB.

## Spec breve

Cada pull request debe pasar, de forma automática y reproducible, la misma barra de calidad que se
exige localmente: **lint, typecheck, format:check y tests**. Los tests no deben tocar la DB real ni
requerir secretos (`DATABASE_URL`, `DIRECT_URL`, claves de Supabase/Resend). El runner se elige y
configura de modo que otros streams puedan **co-ubicar** sus propios tests (`*.test.ts`) sin tocar
nada de esta infra.

## Decisiones

1. **Runner: Vitest** (no Jest). Motivo: ESM/TS nativo sin transpiler extra, arranque rápido,
   API compatible con Jest, y `vitest run` es determinista para CI. Encaja con el stack
   Next 16 + TS + `moduleResolution: bundler`.
2. **Resolución de alias `@/`:** opción nativa `resolve.tsconfigPaths: true` (Vite/Vitest 4) —
   lee `tsconfig.json` como única fuente de verdad, así el alias no se duplica ni se desincroniza.
   (Se descartó el plugin `vite-tsconfig-paths`: Vitest 4 ya lo resuelve de forma nativa y avisa de
   que el plugin es redundante, así que es una dependencia menos.)
3. **Environment `node`:** los smoke tests son helpers puros; no necesitan DOM. Si un stream de UI
   necesita componentes, puede añadir `jsdom`/`happy-dom` en su PR sin romper esta base.
4. **Imports explícitos de `vitest`** (`import { describe, it, expect } from "vitest"`) en vez de
   globals: evita tener que inyectar tipos globales en `tsconfig` y mantiene el typecheck limpio.
5. **Ubicación de tests:** carpeta `tests/` para los smoke de esta infra; el `include` de Vitest
   cubre además `src/**/*.test.ts` para que cada stream co-ubique sus tests junto al código.
6. **Qué se testea (smoke, sin DB):**
   - Un test puro auto-contenido (prueba que el runner + assertions funcionan).
   - Un test que importa `SOURCE` del scraper vía el alias `@/` → prueba que la **resolución de
     módulos y el alias funcionan bajo Vitest** (valor real para CI), sin tocar la DB.
7. **CI sin secretos, pero con placeholders de env para Prisma:** Prisma 7 evalúa
   `env("DIRECT_URL")` al **cargar** `prisma.config.ts`, y eso ocurre en cualquier comando prisma
   — incluido el `prisma generate` del `postinstall`. Si la variable no resuelve, lanza
   `PrismaConfigEnvError`. En local esto pasaba desapercibido porque `import "dotenv/config"` lee el
   archivo `.env` (que existe en el worktree pero **no** en CI). Fix: el workflow define
   `DATABASE_URL`/`DIRECT_URL` como **placeholders no-secretos** (`localhost`) a nivel de job. No se
   conecta a ninguna DB — solo hacen que `env()` resuelva. Se mantiene "sin secretos ni DB real".
   (Se prefirió esto sobre tocar `prisma.config.ts`, que es config compartida entre streams.)
8. **Node 24** en CI (coincide con el runtime de Vercel y con el local).
9. **Triggers:** `pull_request` (requisito) + `push` a `main` (mantiene `main` verde y da señal
   post-merge). `concurrency` cancela runs obsoletos del mismo ref.

## Pasos

1. `npm i -D vitest`.
2. `vitest.config.ts` (`resolve.tsconfigPaths`, environment node, include `tests/**` + `src/**`).
3. `tests/smoke.test.ts` con un par de tests sin DB.
4. Scripts `test` / `test:watch` en `package.json`.
5. `.github/workflows/ci.yml`: checkout → setup-node 24 (cache npm) → `npm ci` →
   lint → typecheck → format:check → test.
6. Verificación local: los 4 comandos en verde + `npm test`. Validar el YAML.

## Follow-ups / dependencias con otros streams

- Cuando el stream de scraping implemente el parser polycard, debería añadir tests con **fixtures**
  (HTML de muestra) co-ubicados como `src/lib/scraper/*.test.ts` — el runner ya los recoge.
- Si aparece lógica de UI, añadir `happy-dom` + `environment: "jsdom"` acotado por archivo.
- Tests que sí necesiten DB deberían ir a una suite de integración aparte (fuera de este CI sin
  secretos), p.ej. contra una Postgres efímera en un workflow separado con `services:`.
- El nombre del proyecto en `package-lock.json` se normalizó a `properties-platform` (antes
  `pp-scaffold`) al reinstalar; cambio inofensivo que viaja en este PR.
