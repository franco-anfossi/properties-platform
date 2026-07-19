import { defineConfig } from "vitest/config";

// Unit tests corren offline por defecto (fixtures). El test de integración en vivo
// (`*.live.test.ts`) se excluye salvo que se pida explícitamente con `npm run test:live`,
// para que la suite no dependa de la red ni del portal externo.
const includeLive = process.env.SCRAPER_LIVE === "1";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    exclude: includeLive
      ? ["node_modules/**"]
      : ["node_modules/**", "src/**/*.live.test.ts"],
    environment: "node",
  },
});
