import { describe, expect, it } from "vitest";

import { buildSearchUrl, slugify } from "../slug";

describe("slugify", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(slugify("Las Condes")).toBe("las-condes");
  });

  it("strips accents and maps ñ to n", () => {
    expect(slugify("Ñuñoa")).toBe("nunoa");
    expect(slugify("Peñalolén")).toBe("penalolen");
  });

  it("collapses non-alphanumerics and trims stray hyphens", () => {
    expect(slugify("  Av. Las Condes #7520 ")).toBe("av-las-condes-7520");
  });
});

describe("buildSearchUrl", () => {
  it("builds a venta/departamento URL for a comuna with the metropolitana region", () => {
    expect(buildSearchUrl({ query: "Las Condes" })).toBe(
      "https://www.portalinmobiliario.com/venta/departamento/las-condes-metropolitana",
    );
  });

  it("honours operation and propertyType overrides", () => {
    expect(
      buildSearchUrl({
        query: "Ñuñoa",
        operation: "arriendo",
        propertyType: "casa",
      }),
    ).toBe(
      "https://www.portalinmobiliario.com/arriendo/casa/nunoa-metropolitana",
    );
  });

  it("does not duplicate the region when the query already ends with it", () => {
    expect(buildSearchUrl({ query: "Providencia Metropolitana" })).toBe(
      "https://www.portalinmobiliario.com/venta/departamento/providencia-metropolitana",
    );
  });
});
