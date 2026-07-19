import { describe, expect, it } from "vitest";

import { SOURCE } from "@/lib/scraper/portal-inmobiliario";

// Smoke tests de la infra de testing (stream CI). No dependen de la DB ni de secretos.
// Objetivo: dar señal verde/roja en cada PR y probar que el runner está bien cableado.

describe("runner sanity", () => {
  // Prueba que Vitest ejecuta y que las assertions funcionan (helper puro).
  it("evaluates pure expressions", () => {
    const sum = (a: number, b: number) => a + b;
    expect(sum(2, 3)).toBe(5);
    expect("portal-inmobiliario".toUpperCase()).toBe("PORTAL-INMOBILIARIO");
  });
});

describe("module resolution", () => {
  // Importa vía el alias `@/` → prueba que la resolución de módulos y el alias de
  // `tsconfig.json` funcionan bajo Vitest. Es la razón de peso de este test en CI.
  it("resolves the `@/` alias and reads the scraper source id", () => {
    expect(SOURCE).toBe("portal-inmobiliario");
  });
});
