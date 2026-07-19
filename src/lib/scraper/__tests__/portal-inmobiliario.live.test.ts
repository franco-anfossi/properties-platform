import { describe, expect, it } from "vitest";

import { searchProperties } from "../portal-inmobiliario";

// Test de integración EN VIVO contra Portal Inmobiliario. Golpea la red real, así que:
//   - Sólo corre con `npm run test:live` (SCRAPER_LIVE=1); la suite normal lo excluye.
//   - Es TOLERANTE: si el portal está caído, bloquea o cambió el HTML, NO falla el build; sólo
//     verifica que `searchProperties` degrada a un estado tipado válido. Cuando responde `ok`,
//     sí valida la forma del contrato (campos mínimos: título + URL clickeable).
describe("searchProperties (live)", () => {
  it("reaches the portal and returns a well-typed outcome", async () => {
    const outcome = await searchProperties({ query: "Las Condes" });

    // Contrato de robustez: siempre un estado conocido, nunca una excepción.
    expect(["ok", "empty", "blocked", "error"]).toContain(outcome.status);
    expect(outcome.source).toBe("portal-inmobiliario");
    expect(typeof outcome.durationMs).toBe("number");

    if (outcome.status !== "ok") {
      // Portal caído / bloqueado / cambió: no rompemos el build, sólo dejamos rastro.
      console.warn(
        `[live] Portal no devolvió 'ok' (status=${outcome.status}, http=${outcome.httpStatus}, err=${outcome.error}). ` +
          "Test tolerante: se omiten las aserciones estrictas.",
      );
      return;
    }

    expect(outcome.results.length).toBeGreaterThan(0);
    for (const p of outcome.results) {
      expect(p.externalId).toMatch(/^MLC/);
      expect(p.title.length).toBeGreaterThan(0);
      expect(p.url).toMatch(/^https?:\/\//);
    }
    console.info(
      `[live] ${outcome.results.length} propiedades en ${outcome.durationMs}ms. ` +
        `Ejemplo: ${outcome.results[0].title} — ${outcome.results[0].price}`,
    );
  }, 20_000);
});
