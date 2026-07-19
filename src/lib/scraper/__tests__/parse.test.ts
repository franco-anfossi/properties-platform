import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { parsePolycards } from "../parse";

function fixture(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)),
    "utf8",
  );
}

describe("parsePolycards", () => {
  const results = parsePolycards(fixture("search-las-condes.html"));

  it("deduplicates listings by externalId", () => {
    // El fixture trae 7 bloques polycard; una publicación aparece 2× (anuncio + normal).
    expect(results).toHaveLength(6);
    const ids = results.map((r) => r.externalId);
    expect(new Set(ids).size).toBe(6);
  });

  it("extracts the core fields of a listing", () => {
    const first = results[0];
    expect(first.externalId).toBe("MLC3384619788");
    expect(first.title).toBe("Las Condes 7520");
  });

  it("formats CLF prices as UF with Chilean thousands separators", () => {
    const first = results[0];
    expect(first.currency).toBe("UF");
    expect(first.price).toBe("UF 4.957");

    const reserva = results.find((r) => r.externalId === "MLC2415695122");
    expect(reserva?.price).toBe("UF 16.725");
  });

  it("builds a stable mlstatic image URL from the picture id", () => {
    expect(results[0].imageUrl).toBe(
      "https://http2.mlstatic.com/D_NQ_NP_689574-MLC103363522566_012026-O.webp",
    );
  });

  it("prefers the canonical permalink over the ad tracking URL and adds a scheme", () => {
    // MLC3384619788 aparece como anuncio (click1…) y como publicación normal (permalink).
    // Debe quedar el permalink, con https:// antepuesto.
    expect(results[0].url).toBe(
      "https://portalinmobiliario.com/MLC-3384619788-las-condes-7520-_JM",
    );
    expect(results[0].url).not.toContain("click1");
  });

  it("returns an empty array for a page with no polycards", () => {
    expect(parsePolycards(fixture("empty-results.html"))).toEqual([]);
  });

  it("does not throw on malformed polycard JSON, just skips it", () => {
    expect(() => parsePolycards(fixture("malformed.html"))).not.toThrow();
    expect(parsePolycards(fixture("malformed.html"))).toEqual([]);
  });
});
