import { defineConfig } from "vitest/config";

// Runner de tests. Vitest por su soporte ESM/TS nativo y arranque rápido.
// `resolve.tsconfigPaths` (nativo en Vitest 4) hace que el alias `@/` de tsconfig
// funcione dentro de los tests.
// Los tests de integración en vivo del scraper (`*.live.test.ts`) se excluyen salvo que
// se pidan con SCRAPER_LIVE=1, para que la suite no dependa de la red ni del portal.
const includeLive = process.env.SCRAPER_LIVE === "1";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: "node",
    // Tests de infra en `tests/` y co-ubicados junto al código en `src/`.
    include: ["tests/**/*.{test,spec}.ts", "src/**/*.{test,spec}.{ts,tsx}"],
    exclude: includeLive
      ? ["node_modules/**"]
      : ["node_modules/**", "src/**/*.live.test.ts"],
  },
});
